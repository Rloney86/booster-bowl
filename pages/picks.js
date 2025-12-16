import { useMemo, useState } from "react";
import Link from "next/link";

const WEEK_1_GAMES = [
  { id: "g1", away: "Varina", home: "Highland Springs", time: "7:00 PM" },
  { id: "g2", away: "Hermitage", home: "John Marshall", time: "7:00 PM" },
  { id: "g3", away: "Thomas Jefferson", home: "Henrico", time: "7:00 PM" },
];

export default function Picks() {
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [picks, setPicks] = useState({}); // { gameId: "home" | "away" }

  const complete = useMemo(() => {
    return name.trim() && school.trim() && Object.keys(picks).length === WEEK_1_GAMES.length;
  }, [name, school, picks]);

  function choose(gameId, side) {
    setPicks((prev) => ({ ...prev, [gameId]: side }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // For now: no database. We’ll wire this up next (Firestore/Supabase).
    alert("Saved locally for now ✅ Next step is wiring picks to a database + leaderboard.");
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card" style={{ marginTop: 12 }}>
        <h1 style={{ marginTop: 0 }}>Make Your Picks</h1>
        <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
          Fill this out and pick winners for the week. Next we’ll connect this to a real database and leaderboard.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button" href="/">Home</Link>
          <Link className="button" href="/about">About</Link>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Your Info</h2>

        <div style={{ display: "grid", gap: 12 }}>
          <label>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Your Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ray Loney"
              style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #2a2a2a", background: "transparent", color: "inherit" }}
            />
          </label>

          <label>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>School / Booster Club</div>
            <input
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="John Marshall Track / Big Blue Boosters"
              style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #2a2a2a", background: "transparent", color: "inherit" }}
            />
          </label>
        </div>

        <hr style={{ margin: "18px 0", borderColor: "#2a2a2a" }} />

        <h2 style={{ marginTop: 0 }}>Week 1 Games</h2>

        <div style={{ display: "grid", gap: 12 }}>
          {WEEK_1_GAMES.map((g) => {
            const pick = picks[g.id];
            return (
              <div key={g.id} className="card" style={{ margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700 }}>
                    {g.away} @ {g.home}
                  </div>
                  <div style={{ opacity: 0.8 }}>{g.time}</div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="button"
                    onClick={() => choose(g.id, "away")}
                    style={{ opacity: pick === "away" ? 1 : 0.65 }}
                  >
                    Pick {g.away}
                  </button>

                  <button
                    type="button"
                    className="button"
                    onClick={() => choose(g.id, "home")}
                    style={{ opacity: pick === "home" ? 1 : 0.65 }}
                  >
                    Pick {g.home}
                  </button>

                  <span style={{ marginLeft: "auto", opacity: 0.85 }}>
                    {pick ? `Selected: ${pick === "home" ? g.home : g.away}` : "No pick yet"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="button" type="submit" disabled={!complete} style={{ opacity: complete ? 1 : 0.5 }}>
            Submit Picks
          </button>
          {!complete && (
            <span style={{ opacity: 0.8 }}>
              Add your name + school and pick all games to submit.
            </span>
          )}
        </div>
      </form>
    </main>
  );
}
