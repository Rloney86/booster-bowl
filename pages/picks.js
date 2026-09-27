import { PICKS_OPEN, CURRENT_WEEK, PICKS_DEADLINE_TEXT } from "../lib/config";
import { useEffect, useMemo, useState } from "react";
import { WEEKLY_GAMES } from "../lib/weeklyGames";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "bb_selected_booster";
const PLAYER_KEY = "bb_player_profile";
const PICKS_KEY = "bb_weekly_picks";

export default function Picks() {
  const games = useMemo(() => WEEKLY_GAMES, []);
  const [selectedBooster, setSelectedBooster] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [user, setUser] = useState(null);
  const [authStep, setAuthStep] = useState("email");
  const [picks, setPicks] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const booster = localStorage.getItem(STORAGE_KEY);
      const profile = localStorage.getItem(PLAYER_KEY);
      const savedPicks = localStorage.getItem(PICKS_KEY);
      if (booster) setSelectedBooster(JSON.parse(booster));
      if (profile) {
        const parsed = JSON.parse(profile);
        setPlayerName(parsed.playerName || "");
        setEmail(parsed.email || "");
      }
      if (savedPicks) setPicks(JSON.parse(savedPicks));
    } catch {}

    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
        setEmail(data.user.email || "");
        setAuthStep("signed-in");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        setEmail(session.user.email || "");
        setAuthStep("signed-in");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const pickedCount = Object.keys(picks).length;

  function choose(gameId, side) {
    if (!PICKS_OPEN || submitted) return;
    const next = { ...picks, [gameId]: side };
    setPicks(next);
    try { localStorage.setItem(PICKS_KEY, JSON.stringify(next)); } catch {}
  }

  function clearAll() {
    if (submitted) return;
    setPicks({});
    setToast("");
    try { localStorage.removeItem(PICKS_KEY); } catch {}
  }

  async function sendCode() {
    if (!playerName.trim() || !email.trim()) {
      setToast("Enter your name and email first.");
      return;
    }
    setBusy(true);
    setToast("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) { setToast("Could not send sign-in code: " + error.message); return; }
    try { localStorage.setItem(PLAYER_KEY, JSON.stringify({ playerName: playerName.trim(), email: email.trim() })); } catch {}
    setAuthStep("otp");
    setToast("📧 Check your email for your Booster Bowl sign-in code.");
  }

  async function verifyCode() {
    if (!otp.trim()) { setToast("Enter the code from your email."); return; }
    setBusy(true); setToast("");
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: "email" });
    setBusy(false);
    if (error) { setToast("That code could not be verified: " + error.message); return; }
    setUser(data.user); setAuthStep("signed-in");
    setToast("✅ Signed in. You can now submit your picks.");
  }

  async function submit() {
    if (submitted || busy) return;
    if (!user) { setToast("Sign in with your email before submitting."); return; }
    if (!playerName.trim()) { setToast("Enter your name before submitting."); return; }
    if (!selectedBooster) { setToast("Choose a booster club before submitting."); return; }
    if (pickedCount !== games.length) { setToast(`Pick ${games.length - pickedCount} more game(s) to submit.`); return; }

    setBusy(true); setToast("Saving your picks...");

    const { data: player, error: playerError } = await supabase.from("players").upsert({
      user_id: user.id,
      display_name: playerName.trim(),
      email: user.email,
      booster_name: selectedBooster.name || "",
      school_name: selectedBooster.school || "",
    }, { onConflict: "user_id" }).select("id").single();

    if (playerError) { setBusy(false); setToast("Could not save your player profile: " + playerError.message); return; }

    const { data: dbGames, error: gamesError } = await supabase.from("games").select("id,away_team,home_team").eq("season", 2026).eq("week", CURRENT_WEEK);
    if (gamesError) { setBusy(false); setToast("Could not load this week's games: " + gamesError.message); return; }

    const existingGames = new Map((dbGames || []).map((g) => [`${g.away_team}|${g.home_team}`, g]));
    const missingGames = games.filter((g) => !existingGames.has(`${g.away}|${g.home}`));
    if (missingGames.length) { setBusy(false); setToast("Weekly games need to be synced by the Booster Bowl admin before picks can be submitted."); return; }

    const desiredRows = games.map((g) => {
      const dbGame = existingGames.get(`${g.away}|${g.home}`);
      return { player_id: player.id, game_id: dbGame.id, selected_team: picks[g.id] === "home" ? g.home : g.away };
    });

    // Read this player's existing picks first. Insert only missing games and
    // update only changed games. This keeps the unique constraint intact and
    // avoids sending existing rows through the INSERT RLS path again.
    const gameIds = desiredRows.map((row) => row.game_id);
    const { data: existingPicks, error: existingPicksError } = await supabase
      .from("picks")
      .select("id,game_id,selected_team")
      .eq("player_id", player.id)
      .in("game_id", gameIds);

    if (existingPicksError) { setBusy(false); setToast("Could not check your saved picks: " + existingPicksError.message); return; }

    const savedByGame = new Map((existingPicks || []).map((row) => [row.game_id, row]));
    const toInsert = desiredRows.filter((row) => !savedByGame.has(row.game_id));
    const toUpdate = desiredRows.filter((row) => {
      const saved = savedByGame.get(row.game_id);
      return saved && saved.selected_team !== row.selected_team;
    });

    if (toInsert.length) {
      const { error } = await supabase.from("picks").insert(toInsert);
      if (error) { setBusy(false); setToast("Could not save your new picks: " + error.message); return; }
    }

    for (const row of toUpdate) {
      const saved = savedByGame.get(row.game_id);
      const { error } = await supabase.from("picks").update({ selected_team: row.selected_team }).eq("id", saved.id).eq("player_id", player.id);
      if (error) { setBusy(false); setToast("Some picks were already saved, but a changed pick could not be updated: " + error.message); return; }
    }

    setBusy(false); setSubmitted(true);
    setToast(toInsert.length || toUpdate.length ? "🏈 Picks saved! You're officially in the Booster Bowl." : "🏈 Your picks were already saved. You're officially in the Booster Bowl.");
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>🏈 Virginia Games of the Week</h1>
        <h2 style={{ marginTop: 6 }}>12 Best VHSL Matchups</h2>
        <p style={{ marginTop: 6, opacity: 0.9 }}>Week {CURRENT_WEEK} — {PICKS_OPEN ? "Picks are OPEN" : "Picks are LOCKED"}.</p>
        <p style={{ marginTop: 6, opacity: 0.8 }}>{PICKS_DEADLINE_TEXT}</p>
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Your name" disabled={submitted} style={{ padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" disabled={authStep !== "email" || submitted} style={{ padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} />
          {!user && authStep === "email" ? <button className="button" onClick={sendCode} disabled={busy}>{busy ? "Sending..." : "Email Me a Sign-In Code"}</button> : null}
          {!user && authStep === "otp" ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><input inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="8-digit email code" style={{ flex: 1, minWidth: 190, padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} /><button className="button" onClick={verifyCode} disabled={busy}>{busy ? "Checking..." : "Verify Code"}</button></div> : null}
          {user ? <div style={{ fontWeight: 700 }}>✅ Signed in as {user.email}</div> : null}
        </div>
        {selectedBooster ? <p style={{ marginTop: 12, opacity: 0.9 }}>Supporting: <b>{selectedBooster.name}</b> ({selectedBooster.school}) — <a href="/boosters" style={{ textDecoration: "none" }}>change</a></p> : <p style={{ marginTop: 12, opacity: 0.85 }}>No booster selected yet — <a href="/boosters" style={{ textDecoration: "none" }}>choose one first</a>.</p>}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
          <div style={{ opacity: 0.9 }}>Picks: <b>{pickedCount}</b> / {games.length}</div>
          <button className="button" onClick={submit} disabled={!PICKS_OPEN || submitted || busy}>{!PICKS_OPEN ? "Picks Locked" : submitted ? "Submitted ✅" : busy ? "Saving..." : "Submit Picks"}</button>
          <button className="button" onClick={clearAll} disabled={submitted || busy} style={{ opacity: submitted ? 0.6 : 1 }}>Clear</button>
          <a href="/" style={{ marginLeft: "auto", textDecoration: "none", opacity: 0.85 }}>← Back Home</a>
        </div>
        {toast ? <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #2a3b57" }}>{toast}</div> : null}
      </div>
      <div style={{ height: 18 }} />
      {games.map((g, index) => {
        const picked = picks[g.id];
        return <div key={g.id} className="card"><div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}><div><div style={{ fontSize: 13, fontWeight: 700, opacity: 0.7, marginBottom: 4 }}>GAME {index + 1} OF {games.length}</div><div style={{ fontSize: 14, opacity: 0.85 }}>Kickoff: {g.kickoff}</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{g.away} <span style={{ opacity: 0.7 }}>at</span> {g.home}</div></div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><PickButton label={`Pick ${g.away}`} active={picked === "away"} onClick={() => choose(g.id, "away")} disabled={submitted} /><PickButton label={`Pick ${g.home}`} active={picked === "home"} onClick={() => choose(g.id, "home")} disabled={submitted} /></div></div><div style={{ marginTop: 10, opacity: 0.9 }}>Your pick: <b>{picked ? (picked === "home" ? g.home : g.away) : "— (none yet)"}</b></div></div>;
      })}
      <div style={{ height: 18 }} />
      <div className="card"><h2 style={{ marginTop: 0 }}>Booster Bowl</h2><p style={{ marginBottom: 0, lineHeight: 1.6 }}>Make your picks. Support your booster club. Compete for season-long bragging rights.</p></div>
    </div>
  );
}

function PickButton({ label, active, onClick, disabled }) {
  return <button className="button" onClick={onClick} disabled={disabled} style={{ transform: active ? "translateY(-1px)" : "none", outline: active ? "2px solid #3b82f6" : "none", opacity: disabled ? 0.6 : 1 }}>{active ? "✅ " : ""}{label}</button>;
}
