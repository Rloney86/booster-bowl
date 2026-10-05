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
    <main className="container">
      <section className="hero">
        <p className="kicker"><span className="kicker-dot" /> LIVE BOOSTER BOWL DASHBOARD</p>
        <h1 className="h1"><span className="grad-text">Booster Bowl</span></h1>
        <p className="lede">
          A high-voltage community fundraiser built around weekly picks, school pride, and season-long bragging rights.
        </p>
      </section>

      <section className="electric-card scan-panel" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <p className="kicker">PERFORMANCE CORE</p>
            <h2 style={{ margin: "8px 0 4px" }}>Dashboard Statistics</h2>
            <p style={{ margin: 0, color: "var(--muted)" }}>Your Booster Bowl command center is online.</p>
          </div>
          <Link href="/picks" className="electric-action">Make Your Picks <span aria-hidden="true">↗</span></Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 24 }}>
          <StatCard label="PICK BOARDS" value="LIVE" accent="" />
          <StatCard label="WEEKLY GAMES" value="OPEN" accent="electric-card-violet" />
          <StatCard label="BOOSTER STATUS" value={selected ? "READY" : "START"} accent="electric-card-lime" />
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 18 }}>
        <div className="electric-card" style={{ padding: 20 }}>
          <p className="kicker">01 / REPRESENT</p>
          <h2 style={{ margin: "8px 0" }}>Choose Your Booster</h2>
          <p style={{ color: "var(--muted)" }}>Select the school program you want to support.</p>
          <Link href="/booster" className="button">Choose a Booster Club</Link>
        </div>
        <div className="electric-card electric-card-violet" style={{ padding: 20 }}>
          <p className="kicker" style={{ color: "var(--violet)" }}>02 / COMPETE</p>
          <h2 style={{ margin: "8px 0" }}>Make Weekly Picks</h2>
          <p style={{ color: "var(--muted)" }}>Lock in your predictions before kickoff.</p>
          <Link href="/picks" className="button secondary">Enter Pick Board</Link>
        </div>
        <div className="electric-card electric-card-lime" style={{ padding: 20 }}>
          <p className="kicker" style={{ color: "var(--lime)" }}>03 / CLIMB</p>
          <h2 style={{ margin: "8px 0" }}>Track Your Rank</h2>
          <p style={{ color: "var(--muted)" }}>See accuracy, momentum, and leaderboard movement.</p>
          <Link href="/leaderboard" className="button secondary">View Leaderboard</Link>
        </div>
      </section>

      {selected ? (
        <section className="electric-card scan-panel" style={{ marginTop: 18, padding: 18 }}>
          <p className="kicker">ACTIVE SUPPORT</p>
          <p style={{ margin: "8px 0 0" }}>Supporting <b style={{ color: "var(--cyan)" }}>{selected.name}</b> ({selected.school}).</p>
        </section>
      ) : null}

      <footer style={{ marginTop: 24, opacity: .75, fontSize: 14 }}>
        Built for schools, families, and community pride.
      </footer>
    </main>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`electric-card ${accent}`} style={{ padding: 18 }}>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, fontWeight: 800, letterSpacing: ".16em" }}>{label}</p>
      <div className="neon-number" style={{ marginTop: 18 }}>{value}</div>
      <div style={{ marginTop: 16, height: 3, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: value === "READY" ? "88%" : "72%", background: "var(--cyan)", boxShadow: "0 0 12px var(--cyan)" }} />
      </div>
    </div>
  );
}
