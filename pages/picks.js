import { PICKS_OPEN, CURRENT_WEEK, PICKS_DEADLINE_TEXT } from "../lib/config";
import { useEffect, useMemo, useState } from "react";
import { PICK_BOARDS, PICK_BOARD_GROUPS } from "../lib/weeklyGames";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "bb_selected_booster";
const PLAYER_KEY = "bb_player_profile";
const PICKS_KEY = "bb_weekly_picks";
const BOARD_KEY = "bb_pick_board";

const ICONS = { Featured: "⭐", District: "📍", Region: "🗺️", Classification: "🏆", School: "🏫" };

export default function Picks() {
  const [boardId, setBoardId] = useState("featured");
  const board = useMemo(() => PICK_BOARDS.find((b) => b.id === boardId) || PICK_BOARDS[0], [boardId]);
  const games = board.games;
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
      const savedBoard = localStorage.getItem(BOARD_KEY);
      const savedPicks = localStorage.getItem(PICKS_KEY);
      if (booster) setSelectedBooster(JSON.parse(booster));
      if (profile) { const parsed = JSON.parse(profile); setPlayerName(parsed.playerName || ""); setEmail(parsed.email || ""); }
      if (savedBoard && PICK_BOARDS.some((b) => b.id === savedBoard)) setBoardId(savedBoard);
      if (savedPicks) setPicks(JSON.parse(savedPicks));
    } catch {}
    supabase.auth.getUser().then(({ data }) => { if (data?.user) { setUser(data.user); setEmail(data.user.email || ""); setAuthStep("signed-in"); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); if (session?.user) { setEmail(session.user.email || ""); setAuthStep("signed-in"); } });
    return () => listener.subscription.unsubscribe();
  }, []);

  const pickedCount = games.filter((g) => picks[g.id]).length;
  function changeBoard(nextId) { if (submitted || busy) return; setBoardId(nextId); setToast(""); try { localStorage.setItem(BOARD_KEY, nextId); } catch {} }
  function choose(gameId, side) { if (!PICKS_OPEN || submitted) return; const next = { ...picks, [gameId]: side }; setPicks(next); try { localStorage.setItem(PICKS_KEY, JSON.stringify(next)); } catch {} }
  function clearAll() { if (submitted) return; const boardIds = new Set(games.map((g) => g.id)); const next = Object.fromEntries(Object.entries(picks).filter(([id]) => !boardIds.has(id))); setPicks(next); setToast(""); try { localStorage.setItem(PICKS_KEY, JSON.stringify(next)); } catch {} }

  async function sendCode() {
    if (!playerName.trim() || !email.trim()) { setToast("Enter your name and email first."); return; }
    setBusy(true); setToast(""); const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }); setBusy(false);
    if (error) { setToast("Could not send sign-in code: " + error.message); return; }
    try { localStorage.setItem(PLAYER_KEY, JSON.stringify({ playerName: playerName.trim(), email: email.trim() })); } catch {}
    setAuthStep("otp"); setToast("📧 Check your email for your Booster Bowl sign-in code.");
  }
  async function verifyCode() {
    if (!otp.trim()) { setToast("Enter the code from your email."); return; }
    setBusy(true); setToast(""); const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: "email" }); setBusy(false);
    if (error) { setToast("That code could not be verified: " + error.message); return; }
    setUser(data.user); setAuthStep("signed-in"); setToast("✅ Signed in. You can now submit your picks.");
  }

  async function submit() {
    if (submitted || busy) return;
    if (!user) { setToast("Sign in with your email before submitting."); return; }
    if (!playerName.trim()) { setToast("Enter your name before submitting."); return; }
    if (!selectedBooster) { setToast("Choose a booster club before submitting."); return; }
    if (!games.length) { setToast("There are no games loaded on this board yet."); return; }
    if (pickedCount !== games.length) { setToast(`Pick ${games.length - pickedCount} more game(s) to submit.`); return; }
    setBusy(true); setToast("Saving your picks...");
    const { data: player, error: playerError } = await supabase.from("players").upsert({ user_id: user.id, display_name: playerName.trim(), email: user.email, booster_name: selectedBooster.name || "", school_name: selectedBooster.school || "" }, { onConflict: "user_id" }).select("id").single();
    if (playerError) { setBusy(false); setToast("Could not save your player profile: " + playerError.message); return; }
    const { data: dbGames, error: gamesError } = await supabase.from("games").select("id,away_team,home_team").eq("season", 2026).eq("week", CURRENT_WEEK);
    if (gamesError) { setBusy(false); setToast("Could not load this week's games: " + gamesError.message); return; }
    const existingGames = new Map((dbGames || []).map((g) => [`${g.away_team}|${g.home_team}`, g]));
    const missingGames = games.filter((g) => !existingGames.has(`${g.away}|${g.home}`));
    if (missingGames.length) { setBusy(false); setToast(`${board.label} is ready to browse, but ${missingGames.length} game${missingGames.length === 1 ? "" : "s"} still need to be synced by the Booster Bowl admin before this board can be submitted.`); return; }
    const desiredRows = games.map((g) => { const dbGame = existingGames.get(`${g.away}|${g.home}`); return { player_id: player.id, game_id: dbGame.id, selected_team: picks[g.id] === "home" ? g.home : g.away }; });
    const gameIds = desiredRows.map((row) => row.game_id);
    const { data: existingPicks, error: existingPicksError } = await supabase.from("picks").select("id,game_id,selected_team").eq("player_id", player.id).in("game_id", gameIds);
    if (existingPicksError) { setBusy(false); setToast("Could not check your saved picks: " + existingPicksError.message); return; }
    const savedByGame = new Map((existingPicks || []).map((row) => [row.game_id, row]));
    const toInsert = desiredRows.filter((row) => !savedByGame.has(row.game_id));
    const toUpdate = desiredRows.filter((row) => { const saved = savedByGame.get(row.game_id); return saved && saved.selected_team !== row.selected_team; });
    if (toInsert.length) { const { error } = await supabase.from("picks").insert(toInsert); if (error) { setBusy(false); setToast("Could not save your new picks: " + error.message); return; } }
    for (const row of toUpdate) { const saved = savedByGame.get(row.game_id); const { error } = await supabase.from("picks").update({ selected_team: row.selected_team }).eq("id", saved.id).eq("player_id", player.id); if (error) { setBusy(false); setToast("Some picks were already saved, but a changed pick could not be updated: " + error.message); return; } }
    setBusy(false); setSubmitted(true); setToast(toInsert.length || toUpdate.length ? `🏈 ${board.shortLabel} picks saved! You're officially in the Booster Bowl.` : `🏈 Your ${board.shortLabel} picks were already saved.`);
  }

  return <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
    <div className="card">
      <h1 style={{ marginTop: 0 }}>🏈 Choose Your Pick Board</h1>
      <p style={{ marginTop: 6, opacity: 0.9 }}>Week {CURRENT_WEEK} — {PICKS_OPEN ? "Picks are OPEN" : "Picks are LOCKED"}.</p><p style={{ marginTop: 6, opacity: 0.8 }}>{PICKS_DEADLINE_TEXT}</p>
      {PICK_BOARD_GROUPS.map((group) => { const groupBoards = PICK_BOARDS.filter((b) => b.group === group); if (!groupBoards.length) return null; return <div key={group} style={{ marginTop: 16 }}><div style={{ fontSize: 13, fontWeight: 800, opacity: 0.7, textTransform: "uppercase", marginBottom: 8 }}>{ICONS[group]} {group}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>{groupBoards.map((b) => <button key={b.id} className="button" onClick={() => changeBoard(b.id)} disabled={submitted || busy} style={{ textAlign: "left", padding: 14, opacity: boardId === b.id ? 1 : 0.68, outline: boardId === b.id ? "2px solid #3b82f6" : "none" }}><div style={{ fontWeight: 800 }}>{b.label}</div><div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>{b.description}</div><div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{b.games.length} game{b.games.length === 1 ? "" : "s"}</div></button>)}</div></div>; })}
      <h2 style={{ marginTop: 22, marginBottom: 4 }}>{ICONS[board.group]} {board.label}</h2><p style={{ marginTop: 0, opacity: 0.8 }}>{games.length ? `${games.length} matchup${games.length === 1 ? "" : "s"} on this board.` : "No games have been loaded on this board yet."}</p>
      <div style={{ display: "grid", gap: 10, marginTop: 18 }}><input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Your name" disabled={submitted} style={{ padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" disabled={authStep !== "email" || submitted} style={{ padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} />{!user && authStep === "email" ? <button className="button" onClick={sendCode} disabled={busy}>{busy ? "Sending..." : "Email Me a Sign-In Code"}</button> : null}{!user && authStep === "otp" ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><input inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="8-digit email code" style={{ flex: 1, minWidth: 190, padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} /><button className="button" onClick={verifyCode} disabled={busy}>{busy ? "Checking..." : "Verify Code"}</button></div> : null}{user ? <div style={{ fontWeight: 700 }}>✅ Signed in as {user.email}</div> : null}</div>
      {selectedBooster ? <p style={{ marginTop: 12, opacity: 0.9 }}>Supporting: <b>{selectedBooster.name}</b> ({selectedBooster.school}) — <a href="/boosters" style={{ textDecoration: "none" }}>change</a></p> : <p style={{ marginTop: 12, opacity: 0.85 }}>No booster selected yet — <a href="/boosters" style={{ textDecoration: "none" }}>choose one first</a>.</p>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}><div style={{ opacity: 0.9 }}>Picks: <b>{pickedCount}</b> / {games.length}</div><button className="button" onClick={submit} disabled={!PICKS_OPEN || submitted || busy || !games.length}>{!PICKS_OPEN ? "Picks Locked" : submitted ? "Submitted ✅" : busy ? "Saving..." : `Submit ${board.shortLabel} Picks`}</button><button className="button" onClick={clearAll} disabled={submitted || busy || !games.length} style={{ opacity: submitted ? 0.6 : 1 }}>Clear Board</button><a href="/" style={{ marginLeft: "auto", textDecoration: "none", opacity: 0.85 }}>← Back Home</a></div>
      {toast ? <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #2a3b57" }}>{toast}</div> : null}
    </div>
    <div style={{ height: 18 }} />
    {games.map((g, index) => { const picked = picks[g.id]; return <div key={g.id} className="card"><div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}><div><div style={{ fontSize: 13, fontWeight: 700, opacity: 0.7, marginBottom: 4 }}>{board.group.toUpperCase()} • GAME {index + 1} OF {games.length}</div><div style={{ fontSize: 14, opacity: 0.85 }}>Kickoff: {g.kickoff}</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{g.away} <span style={{ opacity: 0.7 }}>at</span> {g.home}</div><div style={{ fontSize: 13, opacity: 0.7, marginTop: 5 }}>{[g.district ? `${g.district} District` : null, g.classLabel, g.region].filter(Boolean).join(" • ")}</div></div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><PickButton label={`Pick ${g.away}`} active={picked === "away"} onClick={() => choose(g.id, "away")} disabled={submitted} /><PickButton label={`Pick ${g.home}`} active={picked === "home"} onClick={() => choose(g.id, "home")} disabled={submitted} /></div></div><div style={{ marginTop: 10, opacity: 0.9 }}>Your pick: <b>{picked ? (picked === "home" ? g.home : g.away) : "— (none yet)"}</b></div></div>; })}
    <div style={{ height: 18 }} /><div className="card"><h2 style={{ marginTop: 0 }}>Booster Bowl Pick Boards</h2><p style={{ marginBottom: 0, lineHeight: 1.6 }}>Pick statewide, by district, by region, by VHSL classification, or follow a school. As more schedules are synced, the same structure can expand without changing the scoring engine.</p></div>
  </div>;
}

function PickButton({ label, active, onClick, disabled }) { return <button className="button" onClick={onClick} disabled={disabled} style={{ transform: active ? "translateY(-1px)" : "none", outline: active ? "2px solid #3b82f6" : "none", opacity: disabled ? 0.6 : 1 }}>{active ? "✅ " : ""}{label}</button>; }
