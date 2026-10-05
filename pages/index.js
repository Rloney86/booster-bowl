import Link from "next/link";
import { useEffect, useState } from "react";
import TacticalHudPanel from "../components/TacticalHudPanel";

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

      <div className="home-hud-layout">
        <TacticalHudPanel selectedBooster={selected} />

        <div className="home-main-stack">
          <section className="electric-card scan-panel dashboard-panel hud-grid-card">
            <div className="home-dashboard-header">
              <div>
                <p className="kicker">PERFORMANCE CORE</p>
                <h2>Dashboard Statistics</h2>
                <p className="dashboard-subtext">Your Booster Bowl command center is online.</p>
              </div>
              <Link href="/picks" className="electric-action">Make Your Picks <span aria-hidden="true">↗</span></Link>
            </div>

            <div className="dashboard-stat-grid">
              <StatCard label="PICK BOARDS" value="LIVE" />
              <StatCard label="WEEKLY GAMES" value="OPEN" accent="electric-card-violet" />
              <StatCard label="BOOSTER STATUS" value={selected ? "READY" : "START"} accent="electric-card-lime" ready={Boolean(selected)} />
            </div>
          </section>

          <section className="home-feature-grid">
            <article className="electric-card home-feature-card">
              <p className="kicker">01 / REPRESENT</p>
              <h2>Choose Your Booster</h2>
              <p>Select the school program you want to support.</p>
              <Link href="/booster" className="button">Choose a Booster Club</Link>
            </article>

            <article className="electric-card electric-card-violet home-feature-card">
              <p className="kicker kicker-violet">02 / COMPETE</p>
              <h2>Make Weekly Picks</h2>
              <p>Lock in your predictions before kickoff.</p>
              <Link href="/picks" className="button secondary">Enter Pick Board</Link>
            </article>

            <article className="electric-card electric-card-lime home-feature-card">
              <p className="kicker kicker-lime">03 / CLIMB</p>
              <h2>Track Your Rank</h2>
              <p>See accuracy, momentum, and leaderboard movement.</p>
              <Link href="/leaderboard" className="button secondary">View Leaderboard</Link>
            </article>
          </section>

          {selected ? (
            <section className="electric-card scan-panel active-support-card">
              <p className="kicker">ACTIVE SUPPORT</p>
              <p>Supporting <strong>{selected.name}</strong> ({selected.school}).</p>
            </section>
          ) : null}

          <footer className="home-footer">
            Built for schools, families, and community pride.
          </footer>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, accent = "", ready = false }) {
  return (
    <article className={`electric-card stat-card ${accent}`}>
      <p className="stat-label">{label}</p>
      <div className="neon-number stat-value">{value}</div>
      <div className="stat-track"><span className={ready ? "stat-ready" : ""} /></div>
    </article>
  );
}
