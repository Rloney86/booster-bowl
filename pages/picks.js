import { PICKS_OPEN, CURRENT_WEEK, PICKS_DEADLINE_TEXT } from "../lib/config";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bb_selected_booster";

export default function Picks() {
  const games = useMemo(
  () => [
    {
      id: "g1",
      away: "Varina",
      home: "Highland Springs",
      kickoff: "Fri 7:00 PM",
    },
    {
      id: "g2",
      away: "John Marshall",
      home: "Hermitage",
      kickoff: "Fri 7:00 PM",
    },
    {
      id: "g3",
      away: "Maury",
      home: "Phoebus",
      kickoff: "Fri 7:00 PM",
    },
    {
      id: "g4",
      away: "Hampton",
      home: "Glen Allen",
      kickoff: "Sat 1:00 PM",
    },
    {
      id: "g5",
      away: "Thomas Jefferson",
      home: "Huguenot",
      kickoff: "Sat 4:00 PM",
    },
    {
      id: "g6",
      away: "Woodson High",
      home: "Ballou High School",
      kickoff: "Sat 7:00 PM",
    },
    {
      id: "g7",
      away: "Armstrong",
      home: "Henrico",
      kickoff: "Fri 7:30 PM",
    },
  ],
  []
);
  const [selectedBooster, setSelectedBooster] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSelectedBooster(JSON.parse(raw));
    } catch {}
  }, []);

  // picks[gameId] = "home" | "away"
  const [picks, setPicks] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState("");

  const pickedCount = Object.keys(picks).length;

  function choose(gameId, side) {
    if (!PICKS_OPEN || submitted) return;
    setPicks((prev) => ({ ...prev, [gameId]: side }));
  }

  function clearAll() {
    if (submitted) return;
    setPicks({});
    setToast("");
  }

  function submit() {
    if (submitted) return;

    if (pickedCount !== games.length) {
      setToast(`Pick ${games.length - pickedCount} more game(s) to submit.`);
      return;
    }

    setSubmitted(true);
    setToast("✅ Picks submitted (demo). Backend saving comes next.");
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Make Picks (Demo)</h1>

        <p style={{ marginTop: 6, opacity: 0.9 }}>
          Week {CURRENT_WEEK} — {PICKS_OPEN ? "Picks are OPEN" : "Picks are LOCKED"}.
        </p>
        <p style={{ marginTop: 6, opacity: 0.8 }}>{PICKS_DEADLINE_TEXT}</p>

        {selectedBooster ? (
          <p style={{ marginTop: 10, opacity: 0.9 }}>
            Supporting: <b>{selectedBooster.name}</b> ({selectedBooster.school}) —{" "}
            <a href="/boosters" style={{ textDecoration: "none" }}>
              change
            </a>
          </p>
        ) : (
          <p style={{ marginTop: 10, opacity: 0.85 }}>
            No booster selected yet —{" "}
            <a href="/boosters" style={{ textDecoration: "none" }}>
              choose one first
            </a>
            .
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 14,
          }}
        >
          <div style={{ opacity: 0.9 }}>
            Picks: <b>{pickedCount}</b> / {games.length}
          </div>

          <button className="button" onClick={submit} disabled={!PICKS_OPEN || submitted}>
            {!PICKS_OPEN ? "Picks Locked" : submitted ? "Submitted ✅" : "Submit Picks"}
          </button>

          <button
            className="button"
            onClick={clearAll}
            disabled={submitted}
            style={{ opacity: submitted ? 0.6 : 1 }}
          >
            Clear
          </button>

          <a
            href="/"
            style={{
              marginLeft: "auto",
              textDecoration: "none",
              opacity: 0.85,
            }}
          >
            ← Back Home
          </a>
        </div>

        {toast ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #2a3b57",
              background: "#0a1322",
            }}
          >
            {toast}
          </div>
        ) : null}
      </div>

      <div style={{ height: 18 }} />

      {games.map((g) => {
        const picked = picks[g.id]; // "home" | "away" | undefined

        return (
          <div key={g.id} className="card">
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>Kickoff: {g.kickoff}</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                  {g.away} <span style={{ opacity: 0.7 }}>at</span> {g.home}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PickButton
                  label={`Pick ${g.away}`}
                  active={picked === "away"}
                  onClick={() => choose(g.id, "away")}
                  disabled={submitted}
                />
                <PickButton
                  label={`Pick ${g.home}`}
                  active={picked === "home"}
                  onClick={() => choose(g.id, "home")}
                  disabled={submitted}
                />
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.9 }}>
              Your pick:{" "}
              <b>{picked ? (picked === "home" ? g.home : g.away) : "— (none yet)"}</b>
            </div>
          </div>
        );
      })}

      <div style={{ height: 18 }} />

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Next (after demo)</h2>
        <ol style={{ marginTop: 8, lineHeight: 1.6 }}>
          <li>Save picks (Vercel KV / Supabase / Firebase).</li>
          <li>Leaderboard page.</li>
          <li>Booster share + donate page.</li>
        </ol>
      </div>
    </div>
  );
}

function PickButton({ label, active, onClick, disabled }) {
  return (
    <button
      className="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        transform: active ? "translateY(-1px)" : "none",
        outline: active ? "2px solid #3b82f6" : "none",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {active ? "✅ " : ""}
      {label}
    </button>
  );
}
