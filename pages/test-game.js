import { useMemo, useState } from "react";

const TEST_CODEWORD = "BOWLTEST";
const TEST_CASHAPP = "$boosterbowl";

export default function TestGame() {
  const [codeword, setCodeword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pick, setPick] = useState("");
  const [message, setMessage] = useState("");

  const game = useMemo(() => ({
    id: "tj-armstrong-second-half-test",
    away: "Thomas Jefferson–Richmond",
    home: "Armstrong",
    title: "THE FINISH HIM MATCH",
    subtitle: "PART 2 • SECOND HALF ONLY",
  }), []);

  function unlock(event) {
    event.preventDefault();
    if (codeword.trim().toUpperCase() !== TEST_CODEWORD) {
      setMessage("That codeword did not unlock the test game.");
      setUnlocked(false);
      setPick("");
      return;
    }
    setUnlocked(true);
    setMessage("The second-half showdown is unlocked. Pick the team you believe will finish strongest.");
  }

  function choose(team) {
    setPick(team);
    setMessage(`🔥 You picked ${team} to finish the job! This is a test pick and was not submitted to the live leaderboard.`);
  }

  const cashAppUrl = `https://cash.app/${TEST_CASHAPP.replace(/^\$/, "")}`;

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

            <p style={{ fontSize: 18 }}>Your second-half pick: <b style={{ color: "#fbbf24" }}>{pick || "Choose your closer"}</b></p>

            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #334155" }}>
              <h3 style={{ marginTop: 0 }}>💚 Back Your Pick</h3>
              <p style={{ opacity: .82 }}>
                Support the Booster Bowl test through Cash App. Verify the recipient before sending.
              </p>
              <a
                className="button"
                href={cashAppUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", textDecoration: "none" }}
              >
                Donate via Cash App ({TEST_CASHAPP})
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
