import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const TEST_CODEWORD = "TURKEY BOWL";
const TEST_CASHAPP = "$boosterbowl";
const PARTICIPANT_KEY = "bb_test_game_participant";
const TEST_NAME_KEY = "bb_test_game_name";

function getParticipantKey() {
  let key = localStorage.getItem(PARTICIPANT_KEY);
  if (!key) {
    key = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(PARTICIPANT_KEY, key);
  }
  return key;
}

export default function TestGame() {
  const [codeword, setCodeword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [pick, setPick] = useState("");
  const [sharedPicks, setSharedPicks] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingPicks, setLoadingPicks] = useState(false);

  const game = useMemo(() => ({
    id: "tj-armstrong-second-half-test",
    away: "Thomas Jefferson–Richmond",
    home: "Armstrong",
    title: "THE FINISH HIM MATCH",
    subtitle: "PART 2 • SECOND HALF ONLY",
  }), []);

  useEffect(() => {
    try {
      const savedTestName = localStorage.getItem(TEST_NAME_KEY);
      if (savedTestName) {
        setDisplayName(savedTestName);
        return;
      }
      const profile = JSON.parse(localStorage.getItem("bb_player_profile") || "{}");
      if (profile.playerName) setDisplayName(profile.playerName);
    } catch {}
  }, []);

  async function loadSharedPicks(showLoading = false) {
    if (showLoading) setLoadingPicks(true);
    const { data, error } = await supabase.rpc("get_test_game_picks", {
      p_game_id: game.id,
    });
    if (!error) setSharedPicks(data || []);
    else if (showLoading) setMessage("Could not load the shared picks: " + error.message);
    if (showLoading) setLoadingPicks(false);
  }

  useEffect(() => {
    if (!unlocked) return;
    loadSharedPicks(true);
    const timer = window.setInterval(() => loadSharedPicks(false), 10000);
    return () => window.clearInterval(timer);
  }, [unlocked]);

  function unlock(event) {
    event.preventDefault();
    if (codeword.trim().toUpperCase() !== TEST_CODEWORD) {
      setMessage("That codeword did not unlock the test game.");
      setUnlocked(false);
      setPick("");
      return;
    }
    setUnlocked(true);
    setMessage("The second-half showdown is unlocked. Add your name, make your pick, and lock it in.");
  }

  function choose(team) {
    setPick(team);
    setMessage(`🔥 You selected ${team}. Tap “Lock In My Pick” to save it for everyone to see.`);
  }

  async function submitPick() {
    const name = displayName.trim();
    if (!name) return setMessage("Enter your display name before saving your pick.");
    if (!pick) return setMessage("Choose a team before saving your pick.");
    if (name.length > 40) return setMessage("Keep your display name to 40 characters or fewer.");

    setBusy(true);
    setMessage("Saving your shared pick...");
    try {
      const participantKey = getParticipantKey();
      localStorage.setItem(TEST_NAME_KEY, name);
      const { error } = await supabase.rpc("submit_test_game_pick", {
        p_game_id: game.id,
        p_participant_key: participantKey,
        p_display_name: name,
        p_selected_team: pick,
      });
      if (error) throw error;
      await loadSharedPicks(false);
      setMessage(`✅ ${name}, your pick for ${pick} is saved and visible below.`);
    } catch (error) {
      setMessage("Could not save your pick: " + (error?.message || "Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const cashAppUrl = `https://cash.app/${TEST_CASHAPP.replace(/^\\$/, "")}`;
  const awayPicks = sharedPicks.filter((row) => row.selected_team === game.away);
  const homePicks = sharedPicks.filter((row) => row.selected_team === game.home);

  return (
    <main className="container" style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
      <section
        className="card"
        style={{
          border: "2px solid #f59e0b",
          background: "linear-gradient(145deg, #ffffff 0%, #fff7ed 100%)",
          boxShadow: "0 18px 45px rgba(180, 83, 9, .18)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: ".12em", color: "#b45309" }}>
          🔒 PRIVATE BOOSTER BOWL TEST
        </div>
        <h1 style={{ marginBottom: 8 }}>⚡ Unlock the Secret Matchup</h1>
        <p style={{ marginTop: 0 }}>
          Enter the codeword to reveal a one-game, second-half-only pick challenge.
        </p>

        <form onSubmit={unlock} style={{ display: "grid", gap: 10, marginTop: 18 }}>
          <label htmlFor="test-codeword"><b>Enter the secret codeword</b></label>
          <input
            id="test-codeword"
            value={codeword}
            onChange={(event) => setCodeword(event.target.value)}
            placeholder="Type the codeword"
            autoComplete="off"
          />
          <button className="button" type="submit">🔥 Reveal the Matchup</button>
        </form>

        {unlocked ? (
          <div
            style={{
              marginTop: 22,
              padding: 18,
              border: "2px solid #111827",
              borderRadius: 16,
              background: "#0b1220",
              color: "#ffffff",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#67e8f9", fontWeight: 900, letterSpacing: ".1em" }}>
              {game.subtitle}
            </div>
            <h2 style={{ color: "#fbbf24", fontSize: "clamp(25px, 7vw, 42px)", margin: "10px 0 4px" }}>
              {game.title}
            </h2>
            <p style={{ marginTop: 0, opacity: .82 }}>One half. One pick. Who closes it out?</p>
            <h2 style={{ margin: "22px 0" }}>
              {game.away} <span style={{ color: "#fbbf24" }}>VS.</span> {game.home}
            </h2>

            <label htmlFor="test-display-name" style={{ display: "block", textAlign: "left", marginBottom: 7 }}>
              <b>Your display name</b>
            </label>
            <input
              id="test-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Name shown with your pick"
              maxLength={40}
              style={{ width: "100%", boxSizing: "border-box", marginBottom: 14 }}
            />

            <div style={{ display: "grid", gap: 12 }}>
              {[game.away, game.home].map((team) => (
                <button
                  key={team}
                  className="button"
                  type="button"
                  onClick={() => choose(team)}
                  style={{
                    outline: pick === team ? "3px solid #fbbf24" : "none",
                    transform: pick === team ? "scale(1.02)" : "none",
                  }}
                >
                  {pick === team ? "✅ " : "🏈 "}Pick {team}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 18 }}>
              Your second-half pick: <b style={{ color: "#fbbf24" }}>{pick || "Choose your closer"}</b>
            </p>
            <button className="button" type="button" onClick={submitPick} disabled={busy}>
              {busy ? "Saving..." : "🔒 Lock In My Pick"}
            </button>

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid #334155", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <h3 style={{ margin: 0 }}>👥 Who Picked Who</h3>
                <button className="button" type="button" onClick={() => loadSharedPicks(true)} disabled={loadingPicks} style={{ padding: "8px 12px" }}>
                  {loadingPicks ? "Loading..." : "Refresh"}
                </button>
              </div>
              <p style={{ opacity: .82 }}>
                {sharedPicks.length} saved pick{sharedPicks.length === 1 ? "" : "s"} • updates automatically
              </p>
              <div style={{ display: "grid", gap: 12 }}>
                {[
                  { team: game.away, rows: awayPicks },
                  { team: game.home, rows: homePicks },
                ].map(({ team, rows }) => (
                  <div key={team} style={{ padding: 14, border: "1px solid #334155", borderRadius: 12 }}>
                    <b style={{ color: "#fbbf24" }}>{team} — {rows.length}</b>
                    <div style={{ marginTop: 8, opacity: rows.length ? 1 : .65 }}>
                      {rows.length ? rows.map((row, index) => (
                        <span key={`${row.display_name}-${row.updated_at}-${index}`}>
                          {index ? ", " : ""}{row.display_name}
                        </span>
                      )) : "No picks yet"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #334155" }}>
              <h3 style={{ marginTop: 0 }}>💚 Back Your Pick</h3>
              <p style={{ opacity: .82 }}>
                Testing only. Cash App payments are separate from picks and are not tracked by Booster Bowl. Verify the recipient before sending.
              </p>
              <a
                className="button"
                href={cashAppUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", textDecoration: "none" }}
              >
                💚 Support Your Pick! ({TEST_CASHAPP})
              </a>
            </div>
          </div>
        ) : null}

        {message ? (
          <div style={{ marginTop: 14, padding: 12, border: "1px solid #dbe3ef", borderRadius: 12 }}>
            {message}
          </div>
        ) : null}
      </section>
    </main>
  );
}
