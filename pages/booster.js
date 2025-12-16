import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const STORAGE_KEY = "bb_selected_booster";

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
  const router = useRouter();
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSelected(JSON.parse(raw));
    } catch {}
  }, []);

  function chooseBooster(b) {
    const payload = { id: b.id, school: b.school, name: b.name };
    setSelected(payload);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
    router.push("/picks");
  }

  function clearSelection() {
    setSelected(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card" style={{ marginTop: 24 }}>
        <h1 style={{ marginTop: 0 }}>Choose a Booster Club</h1>
        <p style={{ marginTop: 6, opacity: 0.9 }}>
          Pick a school booster club to support. We’ll remember your selection on this device.
        </p>

        {selected ? (
          <div style={{ marginTop: 12, opacity: 0.95 }}>
            Current selection: <b>{selected.name}</b> ({selected.school}){" "}
            <button className="button" onClick={clearSelection} style={{ marginLeft: 12 }}>
              Clear
            </button>
          </div>
        ) : null}
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
            <p style={{ opacity: 0.85, marginTop: 6 }}>{b.name}</p>

            <button className="button" onClick={() => chooseBooster(b)} style={{ marginTop: 10 }}>
              Support This Booster
            </button>
          </div>
        ))}
      </section>

      <footer style={{ marginTop: 24 }}>
        <a href="/" style={{ textDecoration: "none", opacity: 0.85 }}>
          ← Back Home
        </a>
      </footer>
    </main>
  );
}
