import Link from "next/link";
import { useRouter } from "next/router";

const NAV_ITEMS = [
  { href: "/", label: "Command Center", icon: "⌘" },
  { href: "/picks", label: "Make Picks", icon: "◈" },
  { href: "/leaderboard", label: "Leaderboard", icon: "⊕" },
  { href: "/booster", label: "Booster Club", icon: "⌁" },
];

export default function TacticalHudPanel({ selectedBooster }) {
  const router = useRouter();

  return (
    <aside className="tactical-sidebar hud-angular">
      <span className="hud-crosshair hud-crosshair-top" aria-hidden="true" />
      <span className="hud-crosshair hud-crosshair-bottom" aria-hidden="true" />

      <header className="tactical-header">
        <div>
          <span className="hud-eyebrow">BOOSTER BOWL / HUD-07</span>
          <h2>COMMAND DECK</h2>
        </div>
        <span className="hud-status-dot hud-status-online" title="System online" />
      </header>

      <div className="hud-player-module">
        <div className="hud-player-avatar">BB</div>
        <div>
          <span className="hud-label">ACTIVE BOOSTER</span>
          <strong>{selectedBooster?.name || "NOT SELECTED"}</strong>
          <span className="hud-player-rank">{selectedBooster?.school || "CHOOSE A PROGRAM"}</span>
        </div>
      </div>

      <nav className="tactical-nav" aria-label="Dashboard navigation">
        {NAV_ITEMS.map((item) => {
          const active = router.pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`tactical-nav-item ${active ? "is-active" : ""}`}>
              <span className="hud-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {active ? <span className="hud-active-marker">ACTIVE</span> : null}
            </Link>
          );
        })}
      </nav>

      <section className="hud-status-panel">
        <div className="hud-panel-header">
          <span className="hud-eyebrow">PICK SYSTEM STATUS</span>
          <span className="hud-technical-tag">SECURE</span>
        </div>
        <div className="hud-match-status">
          <span className="hud-status-dot hud-status-searching" />
          <strong>WEEKLY BOARD ONLINE</strong>
        </div>
        <div className="hud-progress-track">
          <div className="hud-progress-fill" />
        </div>
        <div className="hud-telemetry-row">
          <span>MODE: LIVE</span>
          <span>SYNC: STABLE</span>
        </div>
      </section>

      <footer className="tactical-footer">
        <span>SEASON 2026</span>
        <span>LINK STABLE</span>
      </footer>
    </aside>
  );
}
