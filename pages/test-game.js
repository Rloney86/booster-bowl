import { useMemo, useState } from "react";

const TEST_CODEWORD = "BOWLTEST";
const TEST_CASHAPP = process.env.NEXT_PUBLIC_TEST_CASHAPP || "$BoosterBowlTest";

export default function TestGame() {
  const [codeword, setCodeword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pick, setPick] = useState("");
  const [message, setMessage] = useState("");

  const game = useMemo(() => ({
    id: "test-game-001",
    away: "Booster Bowl Test A",
    home: "Booster Bowl Test B",
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
    setMessage("Test game unlocked. Choose one team, then use Cash App if you want to test the donation flow.");
  }

  function choose(team) {
    setPick(team);
    setMessage(`Test pick saved locally: ${team}. No live pick was submitted.`);
  }

  const cashAppUrl = `https://cash.app/${TEST_CASHAPP.replace(/^\$/, "")}`;

  return (
    <main className="container" style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
      <section className="card" style={{ border: "2px dashed #f59e0b" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", color: "#b45309" }}>
          PRIVATE TEST PAGE
        </div>
        <h1 style={{ marginBottom: 8 }}>🏈 Single-Game Test</h1>
        <p style={{ marginTop: 0 }}>
          This page is intentionally hidden from the site navigation. It does not write to the live picks table or process payments.
        </p>

        <form onSubmit={unlock} style={{ display: "grid", gap: 10, marginTop: 18 }}>
          <label htmlFor="test-codeword"><b>Enter test codeword</b></label>
          <input
            id="test-codeword"
            value={codeword}
            onChange={(event) => setCodeword(event.target.value)}
            placeholder="Type the codeword"
            autoComplete="off"
          />
          <button className="button" type="submit">Generate Test Game</button>
        </form>

        {unlocked ? (
          <div style={{ marginTop: 22, padding: 16, border: "1px solid #dbe3ef", borderRadius: 14 }}>
            <div style={{ fontSize: 13, opacity: .7 }}>TEST MATCHUP</div>
            <h2>{game.away} at {game.home}</h2>
            <p>Choose a side for testing only:</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[game.away, game.home].map((team) => (
                <button
                  key={team}
                  className="button"
                  type="button"
                  onClick={() => choose(team)}
                  style={{ outline: pick === team ? "2px solid #3b82f6" : "none" }}
                >
                  {pick === team ? "✅ " : ""}{team}
                </button>
              ))}
            </div>
            <p>Your test pick: <b>{pick || "—"}</b></p>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #dbe3ef" }}>
              <h3 style={{ marginTop: 0 }}>Optional Cash App donation test</h3>
              <p style={{ opacity: .8 }}>
                This opens Cash App externally. Verify the recipient before sending any real money.
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
