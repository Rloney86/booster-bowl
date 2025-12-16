import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const PICKS_KEY = "bb_picks_week_1";
const BOOSTER_KEY = "bb_selected_booster";
const DONATIONS_KEY = "bb_donations_by_booster"; // { [boosterId]: number }

// demo results: gameId -> "home" | "away"
const RESULTS = {
  g1: "home",
  g2: "away",
  g3: "home",
  g4: "away",
  g5: "home",
};

// Demo boosters (now includes Maury + Glen Allen)
const BOOSTER_STATS = [
  {
    id: "jmhs",
    name: "Big Blue Boosters",
    supporters: 42,
    totalPicks: 840,
    donations: 2150,
    goal: 5000,
  },
  {
    id: "hsprings",
    name: "Springers Booster Club",
    supporters: 37,
    totalPicks: 710,
    donations: 1780,
    goal: 4500,
  },
  {
    id: "varina",
    name: "Blue Devils Boosters",
    supporters: 29,
    totalPicks: 520,
    donations: 1325,
    goal: 4000,
  },
  {
    id: "maury",
    name: "Maury Boosters",
    supporters: 31,
    totalPicks: 610,
    donations: 1540,
    goal: 4200,
  },
  {
    id: "glenallen",
    name: "Jaguar Nation",
    supporters: 26,
    totalPicks: 480,
    donations: 1210,
    goal: 3800,
  },
];

function safeParseJSON(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function calcAccuracy(picks) {
  if (!picks) return null;
  const ids = Object.keys(RESULTS);
  const total = ids.length;
  let correct = 0;

  for (const gameId of ids) {
    if (picks[gameId] && picks[gameId] === RESULTS[gameId]) correct++;
  }

  return {
    correct,
    total,
    percent: Math.round((correct / total) * 100),
  };
}

// Make a "team rating" that feels real (demo formula)
// - base 70
// - + accuracy influence (0–20)
// - + donation influence (0–10)
function calcTeamRating({ accuracyPercent, donationsTotal, goal }) {
  const accPart = Math.round((accuracyPercent / 100) * 20); // 0..20
  const donationProgress = goal ? Math.min(1, donationsTotal / goal) : 0;
  const donPart = Math.round(donationProgress * 10); // 0..10
  return Math.max(0, Math.min(100, 70 + accPart + donPart));
}

// Incentives unlock by donation progress
function getIncentives(progress) {
  const unlocked = [];
  if (progress >= 0.25) unlocked.push("🎺 Pep Band Shoutout");
  if (progress >= 0.5) unlocked.push("📸 Team Spotlight Post");
  if (progress >= 0.75) unlocked.push("🎁 Sponsor Prize Drop");
  if (progress >= 1) unlocked.push("🏆 Booster Bowl Champions Banner");
  return unlocked;
}

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.9 }}>
        <span>Fundraising</span>
        <span>
          <b>{pct}%</b>
        </span>
      </div>

      <div
        style={{
          marginTop: 8,
          height: 12,
          borderRadius: 999,
          border: "1px solid #2a3b57",
          background: "#0a1322",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #2563eb, #60a5fa)",
          }}
        />
      </div>

      <div style={{ marginTop: 8, opacity: 0.85, fontSize: 14 }}>
        ${value.toLocaleString()} raised • Goal ${max.toLocaleString()}
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [myBooster, setMyBooster] = useState(null);
  const [myPicks, setMyPicks] = useState(null);
  const [sortBy, setSortBy] = useState("donations"); // "donations" | "rating"
  const [donationsByBooster, setDonationsByBooster] = useState({});

  useEffect(() => {
    // Selected booster
    const b = safeParseJSON(localStorage.getItem(BOOSTER_KEY), null);
    if (b) setMyBooster(b);

    // Picks
    const p = safeParseJSON(localStorage.getItem(PICKS_KEY), null);
    if (p) setMyPicks(p);

    // Donations map
    const d = safeParseJSON(localStorage.getItem(DONATIONS_KEY), {});
    setDonationsByBooster(d || {});
  }, []);

  const myAccuracy = useMemo(() => calcAccuracy(myPicks), [myPicks]);

  function addDonation(amount) {
    if (!myBooster?.id) return;

    setDonationsByBooster((prev) => {
      const next = { ...(prev || {}) };
      next[myBooster.id] = (next[myBooster.id] || 0) + amount;

      try {
        localStorage.setItem(DONATIONS_KEY, JSON.stringify(next));
      } catch {}

      return next;
    });
  }

  const computedBoosters = useMemo(() => {
    return BOOSTER_STATS.map((b, idx) => {
      const extra = donationsByBooster?.[b.id] || 0;
      const donationsTotal = b.donations + extra;

      // demo accuracy baseline per team (so rating isn't random)
      const accuracyPercent = Math.max(70, 92 - idx * 3);

      const rating = calcTeamRating({
        accuracyPercent,
        donationsTotal,
        goal: b.goal,
      });

      const progress = b.goal ? Math.min(1, donationsTotal / b.goal) : 0;

      return {
        ...b,
        accuracyPercent,
        donationsTotal,
        rating,
        progress,
        incentives: getIncentives(progress),
        extraDonation: extra,
      };
    });
  }, [donationsByBooster]);

  const sortedBoosters = useMemo(() => {
    const arr = [...computedBoosters];

    if (sortBy === "rating") {
      arr.sort((a, b) => b.rating - a.rating);
    } else {
      arr.sort((a, b) => b.donationsTotal - a.donationsTotal);
    }

    return arr;
  }, [computedBoosters, sortBy]);

  const myTeam = useMemo(() => {
    if (!myBooster?.id) return null;
    return computedBoosters.find((b) => b.id === myBooster.id) || null;
  }, [myBooster, computedBoosters]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Booster Bowl Leaderboard</h1>
        <p style={{ opacity: 0.9 }}>Season 2026 — Team Stat Book View (Demo)</p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <Link href="/" className="button">← Back Home</Link>
          <Link href="/booster" className="button">Choose Booster</Link>
          <Link href="/picks" className="button">Make Picks</Link>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ opacity: 0.9 }}>Sort by:</div>
          <button
            className="button"
            onClick={() => setSortBy("donations")}
            style={{ opacity: sortBy === "donations" ? 1 : 0.75 }}
          >
            💰 Donations
          </button>
          <button
            className="button"
            onClick={() => setSortBy("rating")}
            style={{ opacity: sortBy === "rating" ? 1 : 0.75 }}
          >
            🎯 Rating
          </button>
        </div>
      </section>

      <div style={{ height: 18 }} />

      {/* MY STAT BOOK */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>My Stat Book</h2>

        {myBooster ? (
          <p style={{ marginTop: 6, opacity: 0.9 }}>
            Selected booster: <b>{myBooster.name}</b> ({myBooster.school})
          </p>
        ) : (
          <p style={{ marginTop: 6, opacity: 0.85 }}>
            No booster selected yet.
          </p>
        )}

        {myAccuracy ? (
          <>
            <p style={{ margin: "6px 0" }}>
              🎯 Booster Bowl Rating (picks): <b>{myAccuracy.percent}%</b>
            </p>
            <p style={{ margin: "6px 0" }}>
              📊 Picks: <b>{myAccuracy.correct}</b> / {myAccuracy.total}
            </p>
          </>
        ) : (
          <p style={{ marginTop: 10, opacity: 0.85 }}>
            No picks submitted yet — submit picks to generate your rating.
          </p>
        )}

        {myTeam ? (
          <>
            <ProgressBar value={myTeam.donationsTotal} max={myTeam.goal} />

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="button" onClick={() => addDonation(10)} disabled={!myBooster}>
                +$10 Demo Donation
              </button>
              <button className="button" onClick={() => addDonation(25)} disabled={!myBooster}>
                +$25 Demo Donation
              </button>
              <button className="button" onClick={() => addDonation(100)} disabled={!myBooster}>
                +$100 Demo Donation
              </button>
            </div>

            <div style={{ marginTop: 10, opacity: 0.85 }}>
              Unlocked incentives:{" "}
              <b>{myTeam.incentives.length ? myTeam.incentives.join(" • ") : "— none yet"}</b>
            </div>
          </>
        ) : null}
      </section>

      <div style={{ height: 18 }} />

      {/* BOOSTER LEADERBOARD */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {sortedBoosters.map((b, index) => (
          <div key={b.id} className="card">
            <h3 style={{ marginTop: 0 }}>
              #{index + 1} — {b.name}
            </h3>

            <p style={{ margin: "6px 0" }}>
              🎯 Booster Bowl Rating: <b>{b.rating}%</b>
            </p>

            <p style={{ margin: "6px 0" }}>
              👥 Supporters: <b>{b.supporters}</b>
            </p>

            <p style={{ margin: "6px 0" }}>
              📊 Total Picks: <b>{b.totalPicks}</b>
            </p>

            <p style={{ margin: "6px 0" }}>
              💰 Donations: <b>${b.donationsTotal.toLocaleString()}</b>
              {b.extraDonation ? (
                <span style={{ opacity: 0.8 }}> (includes +${b.extraDonation.toLocaleString()} demo)</span>
              ) : null}
            </p>

            <ProgressBar value={b.donationsTotal} max={b.goal} />

            <div style={{ marginTop: 10, opacity: 0.85 }}>
              Incentives:{" "}
              <b>{b.incentives.length ? b.incentives.join(" • ") : "— not unlocked yet"}</b>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
