import Link from "next/link";
import { useRouter } from "next/router";

const BOOSTERS = {
  jmhs: { school: "John Marshall High School", name: "Big Blue Boosters" },
  hsprings: { school: "Highland Springs High School", name: "Springers Booster Club" },
  varina: { school: "Varina High School", name: "Blue Devils Boosters" },
};

export default function BoosterProfile() {
  const router = useRouter();
  const { id } = router.query;

  const booster = id ? BOOSTERS[id] : null;

  if (!id) return null;

  if (!booster) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <h1>Booster not found</h1>
        <p>That booster page doesn’t exist yet.</p>
        <Link className="button" href="/booster">
          Back to Booster List
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card" style={{ marginTop: 24 }}>
        <h1 style={{ marginTop: 0 }}>{booster.name}</h1>
        <p style={{ opacity: 0.9, fontSize: 18 }}>{booster.school}</p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <Link
            className="button"
            href={{ pathname: "/picks", query: { booster: id } }}
          >
            Make Picks for This Booster
          </Link>

          <Link className="button" href="/booster">
            Choose Another Booster
          </Link>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>About</h2>
        <p style={{ opacity: 0.85, lineHeight: 1.7 }}>
          This page is where we’ll show your booster’s fundraiser info, standings,
          and a share link for supporters.
        </p>
      </section>
    </main>
  );
}
