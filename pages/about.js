import Link from "next/link";

export default function About() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card" style={{ marginTop: 12 }}>
        <h1 style={{ marginTop: 0 }}>About Booster Bowl</h1>
        <p style={{ fontSize: 16, opacity: 0.9, lineHeight: 1.6 }}>
          Booster Bowl is a community game where people make weekly picks and
          support school booster clubs. The goal is simple: build friendly
          competition, drive participation, and help programs raise funds.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <Link className="button" href="/">
            Back Home
          </Link>
          <a className="button" href="#faq">
            FAQ
          </a>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>How it Works</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            <strong>Pick a school</strong> (or booster club) you want to support.
          </li>
          <li>
            <strong>Make weekly picks</strong> before games start.
          </li>
          <li>
            <strong>Earn points</strong> and move up the leaderboard.
          </li>
          <li>
            <strong>Support the program</strong> — boosters benefit from the community activity.
          </li>
        </ol>
      </section>

      <section id="faq" className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>FAQ</h2>

        <p><strong>Is this gambling?</strong><br />
          No — this is designed as a booster fundraiser + community competition.
        </p>

        <p><strong>How do points work?</strong><br />
          Next step: we’ll define a simple scoring system (ex: 1 point per correct pick).
        </p>

        <p><strong>What’s coming next?</strong><br />
          Weekly game slate, pick submission page, leaderboard, and a booster club page.
        </p>
      </section>
    </main>
  );
}
