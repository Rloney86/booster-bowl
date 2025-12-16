import Link from "next/link";

const BOOSTER_STATS = [
  {
    id: "jmhs",
    name: "Big Blue Boosters",
    supporters: 42,
    totalPicks: 840,
    accuracy: 91,
    donations: 2150,
  },
  {
    id: "hsprings",
    name: "Springers Booster Club",
    supporters: 37,
    totalPicks: 710,
    accuracy: 88,
    donations: 1780,
  },
  {
    id: "varina",
    name: "Blue Devils Boosters",
    supporters: 29,
    totalPicks: 520,
    accuracy: 84,
    donations: 1325,
  },
];

export default function Leaderboard() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {/* HEADER */}
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Booster Bowl Leaderboard</h1>
        <p style={{ opacity: 0.9 }}>
          Season 2026 · Team Stat Book View (Demo Data)
        </p>

        <Link href="/" className="button" style={{ marginTop: 12 }}>
          ← Back Home
        </Link>
      </section>

      <div style={{ height: 18 }} />

      {/* BOOSTER STAT BOOK */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {BOOSTER_STATS.map((b, index) => (
          <div key={b.id} className="card">
            <h3 style={{ marginTop: 0 }}>
              #{index + 1} — {b.name}
            </h3>

            <p style={{ margin: "6px 0" }}>
              🎯 Booster Bowl Rating: <b>{b.accuracy}%</b>
            </p>

            <p style={{ margin: "6px 0" }}>
              👥 Supporters: <b>{b.supporters}</b>
            </p>

            <p style={{ margin: "6px 0" }}>
              📊 Total Picks: <b>{b.totalPicks}</b>
            </p>

            <p style={{ margin: "6px 0" }}>
              💰 Donations (demo):{" "}
              <b>${b.donations.toLocaleString()}</b>
            </p>

            <div style={{ marginTop: 10, opacity: 0.8 }}>
              Incentive:{" "}
              {index === 0
                ? "🏆 Top Booster"
                : index === 1
                ? "🔥 Hot Streak"
                : "💪 Rising Program"}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
