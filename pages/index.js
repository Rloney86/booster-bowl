import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "bb_selected_booster";

export default function Home() {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSelected(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {/* HERO */}
      <section className="card" style={{ marginTop: 24 }}>
        <h1 style={{ marginTop: 0 }}>Booster Bowl</h1>

        <p style={{ fontSize: 18, opacity: 0.95, lineHeight: 1.5 }}>
          A community fundraiser that helps school booster clubs raise support —
          with friendly competition and season-long bragging rights.
        </p>

        {selected ? (
          <p style={{ marginTop: 10, opacity: 0.9 }}>
            Selected booster: <b>{selected.name}</b> ({selected.school})
          </p>
        ) : (
          <p style={{ marginTop: 10, opacity: 0.85 }}>
            No booster selected yet — choose one to get started.
          </p>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <Link href="/boosters" className="button">
            Choose a Booster Club
          </Link>

          <Link href="/picks" className="button">
            Make Picks
          </Link>

          <a className="button" href="#how-it-works">
            How it Works
          </a>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>How it Works</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            <strong>Choose your school / booster</strong> — rep your program.
          </li>
          <li>
            <strong>Make your weekly picks</strong> — lock them in before kickoff.
          </li>
          <li>
            <strong>Climb the leaderboard</strong> — and help fund the team.
          </li>
        </ol>
      </section>

      {/* FEATURE CARDS */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginTop: 18,
        }}
      >
        <div className="card">
          <h3 style={{ marginTop: 0 }}>This Week’s Games</h3>
          <p style={{ opacity: 0.85 }}>
            Coming next: a weekly slate of matchups you can pick in seconds.
          </p>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Leaderboard</h3>
          <p style={{ opacity: 0.85 }}>
            See who’s on top — weekly champs + season bragging rights.
          </p>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Support Booster Clubs</h3>
          <p style={{ opacity: 0.85 }}>
            Every school gets a shareable page to rally community support.
          </p>
        </div>
      </section>

      <footer style={{ marginTop: 24, opacity: 0.75, fontSize: 14 }}>
        Built for schools, families, and community pride.
      </footer>
    </main>
  );
}
