import Link from "next/link";

const BOOSTERS = [
  {
    id: "jmhs",
    school: "John Marshall High School",
    name: "Big Blue Boosters",
  },
  {
    id: "hsprings",
    school: "Highland Springs High School",
    name: "Springers Booster Club",
  },
  {
    id: "varina",
    school: "Varina High School",
    name: "Blue Devils Boosters",
  },
];

export default function Boosters() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card" style={{ marginTop: 12 }}>
        <h1 style={{ marginTop: 0 }}>Choose a Booster Club</h1>
        <p style={{ lineHeight: 1.6, opacity: 0.9 }}>
          Booster Bowl is a fundraiser-first platform.  
          Start by choosing the school or booster club you want to support.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 18,
        }}
      >
        {BOOSTERS.map((b) => (
          <div key={b.id} className="card">
            <h3 style={{ marginTop: 0 }}>{b.school}</h3>
            <p style={{ opacity: 0.85 }}>{b.name}</p>

            <Link className="button" href={`/booster/${b.id}`}>
  View Booster Page
</Link>
          </div>
        ))}
      </section>

      <footer style={{ marginTop: 24 }}>
        <Link className="button" href="/">
          Back Home
        </Link>
      </footer>
    </main>
  );
}
