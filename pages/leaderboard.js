import Link from "next/link";

const DEMO_WEEK = 1;

const DEMO_LEADERBOARD = [
  { rank: 1, boosterId: "jmhs", boosterName: "Big Blue Boosters", school: "John Marshall HS", correct: 9, total: 12, entries: 38 },
  { rank: 2, boosterId: "hsprings", boosterName: "Springers Booster Club", school: "Highland Springs HS", correct: 8, total: 12, entries: 31 },
  { rank: 3, boosterId: "varina", boosterName: "Blue Devils Boosters", school: "Varina HS", correct: 7, total: 12, entries: 24 },
];

export default function Leaderboard() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card" style={{ marginTop: 24 }}>
        <h1 style={{ marginTop: 0 }}>Leaderboard (Demo)</h1>
        <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
          Week {DEMO_WEEK} — demo rankings only (no database yet). This is where booster clubs compete for
          bragging rights and community momentum.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <Link className="button" href="/">
            Home
          </Link>
          <Link className="button" href="/booster">
            Choose Booster
          </Link>
          <Link className="button" href="/picks">
            Make Picks
          </Link>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Booster Rankings</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.85 }}>
                <th style={{ padding: "10px 8px" }}>Rank</th>
                <th style={{ padding: "10px 8px" }}>Booster</th>
                <th style={{ padding: "10px 8px" }}>School</th>
                <th style={{ padding: "10px 8px" }}>Correct</th>
                <th style={{ padding: "10px 8px" }}>Entries</th>
                <th style={{ padding: "10px 8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_LEADERBOARD.map((row) => {
                const pct = Math.round((row.correct / row.total) * 100);
                return (
                  <tr key={row.boosterId} style={{ borderTop: "1px solid #2a2a2a" }}>
                    <td style={{ padding: "12px 8px", fontWeight: 700 }}>#{row.rank}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ fontWeight: 700 }}>{row.boosterName}</div>
                      <div style={{ opacity: 0.8, fontSize: 13 }}>{pct}% correct</div>
                    </td>
                    <td style={{ padding: "12px 8px", opacity: 0.9 }}>{row.school}</td>
                    <td style={{ padding: "12px 8px" }}>
                      {row.correct} / {row.total}
                    </td>
                    <td style={{ padding: "12px 8px" }}>{row.entries}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <Link className="button" href={`/booster/${row.boosterId}`}>
                        View Booster
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 14, opacity: 0.8, fontSize: 13 }}>
          Next: this table will auto-update from saved picks and final scores.
        </p>
      </section>
    </main>
  );
}
