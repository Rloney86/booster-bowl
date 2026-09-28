import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const BOOSTER_KEY = "bb_selected_booster";
const DONATIONS_KEY = "bb_donations_by_booster";

const BOOSTER_STATS = [
  { id: "jmhs", name: "Big Blue Boosters", school: "John Marshall High School", supporters: 42, totalPicks: 840, donations: 2150, goal: 5000 },
  { id: "hsprings", name: "Springers Booster Club", school: "Highland Springs High School", supporters: 37, totalPicks: 710, donations: 1780, goal: 4500 },
  { id: "varina", name: "Blue Devils Boosters", school: "Varina High School", supporters: 29, totalPicks: 520, donations: 1325, goal: 4000 },
  { id: "maury", name: "Maury Boosters", school: "Maury High School", supporters: 31, totalPicks: 610, donations: 1540, goal: 4200 },
  { id: "glenallen", name: "Jaguar Nation", school: "Glen Allen High School", supporters: 26, totalPicks: 480, donations: 1210, goal: 3800 },
];

function safeParseJSON(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

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
        <span><b>{pct}%</b></span>
      </div>
      <div style={{ marginTop: 8, height: 12, borderRadius: 999, border: "1px solid #2a3b57", background: "#0a1322", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #2563eb, #60a5fa)" }} />
      </div>
      <div style={{ marginTop: 8, opacity: 0.85, fontSize: 14 }}>
        ${value.toLocaleString()} raised • Goal ${max.toLocaleString()}
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [myBooster, setMyBooster] = useState(null);
  const [myAccuracy, setMyAccuracy] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [teamStats, setTeamStats] = useState([]);
  const [teamStatsLive, setTeamStatsLive] = useState(false);
  const [teamStatsMessage, setTeamStatsMessage] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [donationsByBooster, setDonationsByBooster] = useState({});

  useEffect(() => {
    const b = safeParseJSON(localStorage.getItem(BOOSTER_KEY), null);
    if (b) setMyBooster(b);
    setDonationsByBooster(safeParseJSON(localStorage.getItem(DONATIONS_KEY), {}) || {});

    let cancelled = false;

    async function loadLeaderboard() {
      try {
        const { data, error } = await supabase.rpc("get_booster_leaderboard");
        if (error) throw error;
        if (!cancelled) {
          setTeamStats(data || []);
          setTeamStatsLive(true);
          setTeamStatsMessage("");
        }
      } catch {
        if (!cancelled) {
          setTeamStatsLive(false);
          setTeamStatsMessage("Team standings are using demo numbers until the leaderboard SQL is activated.");
        }
      }
    }

    async function loadMyStats() {
      setStatsLoading(true);
      setStatsError("");

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const user = sessionData?.session?.user;
        if (!user) return;

        const { data: player, error: playerError } = await supabase
          .from("players")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (playerError) throw playerError;
        if (!player) return;

        const { data: savedPicks, error: picksError } = await supabase
          .from("picks")
          .select("game_id,selected_team")
          .eq("player_id", player.id);
        if (picksError) throw picksError;
        if (!savedPicks?.length) return;

        const gameIds = [...new Set(savedPicks.map((p) => p.game_id))];
        const { data: finalGames, error: gamesError } = await supabase
          .from("games")
          .select("id,winner,is_final")
          .in("id", gameIds)
          .eq("is_final", true);
        if (gamesError) throw gamesError;

        const winners = new Map((finalGames || []).map((g) => [String(g.id), g.winner]));
        const completedPicks = savedPicks.filter((p) => winners.has(String(p.game_id)));
        const correct = completedPicks.filter((p) => p.selected_team === winners.get(String(p.game_id))).length;
        const total = completedPicks.length;

        if (!cancelled) {
          setMyAccuracy({
            correct,
            total,
            percent: total ? Math.round((correct / total) * 100) : 0,
          });
        }
      } catch (error) {
        if (!cancelled) setStatsError(error?.message || "Unable to load results.");
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    loadLeaderboard();
    loadMyStats();

    return () => {
      cancelled = true;
    };
  }, []);

  function addDonation(amount) {
    if (!myBooster?.id) return;
    setDonationsByBooster((prev) => {
      const next = {
        ...(prev || {}),
        [myBooster.id]: ((prev || {})[myBooster.id] || 0) + amount,
      };
      try {
        localStorage.setItem(DONATIONS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const liveByName = useMemo(
    () => new Map((teamStats || []).map((row) => [row.booster_name, row])),
    [teamStats]
  );

  const computedBoosters = useMemo(() => {
    const unique = Array.from(new Map(BOOSTER_STATS.map((b) => [b.id, b])).values());

    return unique.map((b, idx) => {
      const live = liveByName.get(b.name);
      const extra = donationsByBooster?.[b.id] || 0;
      const donationsTotal = b.donations + extra;

      const supporters = teamStatsLive ? Number(live?.supporters || 0) : b.supporters;
      const totalPicks = teamStatsLive ? Number(live?.total_picks || 0) : b.totalPicks;
      const completedPicks = teamStatsLive ? Number(live?.completed_picks || 0) : 0;
      const correctPicks = teamStatsLive ? Number(live?.correct_picks || 0) : 0;
      const accuracyPercent = teamStatsLive
        ? Number(live?.accuracy_percent || 0)
        : Math.max(70, 92 - idx * 3);

      const progress = b.goal ? Math.min(1, donationsTotal / b.goal) : 0;

      return {
        ...b,
        supporters,
        totalPicks,
        completedPicks,
        correctPicks,
        accuracyPercent,
        rating: accuracyPercent,
        donationsTotal,
        progress,
        incentives: getIncentives(progress),
        extraDonation: extra,
      };
    });
  }, [donationsByBooster, liveByName, teamStatsLive]);

  const sortedBoosters = useMemo(() => {
    const arr = [...computedBoosters];
    if (sortBy === "rating") {
      arr.sort(
        (a, b) =>
          (b.rating - a.rating) ||
          (b.correctPicks - a.correctPicks) ||
          (b.supporters - a.supporters) ||
          a.name.localeCompare(b.name)
      );
    } else {
      arr.sort(
        (a, b) =>
          (b.donationsTotal - a.donationsTotal) ||
          (b.rating - a.rating) ||
          a.name.localeCompare(b.name)
      );
    }
    return arr;
  }, [computedBoosters, sortBy]);

  const myTeam = useMemo(
    () => (myBooster?.id ? computedBoosters.find((b) => b.id === myBooster.id) || null : null),
    [myBooster, computedBoosters]
  );

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Booster Bowl Leaderboard</h1>
        <p style={{ opacity: 0.9 }}>
          Season 2026 — {teamStatsLive ? "Live Team Standings" : "Team Stat Book View"}
        </p>

        {teamStatsMessage ? (
          <p style={{ marginTop: 8, opacity: 0.75 }}>{teamStatsMessage}</p>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <Link href="/" className="button">← Back Home</Link>
          <Link href="/booster" className="button">Choose Booster</Link>
          <Link href="/picks" className="button">Make Picks</Link>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ opacity: 0.9 }}>Sort by:</div>
          <button className="button" onClick={() => setSortBy("rating")} style={{ opacity: sortBy === "rating" ? 1 : 0.75 }}>
            🎯 Rating
          </button>
          <button className="button" onClick={() => setSortBy("donations")} style={{ opacity: sortBy === "donations" ? 1 : 0.75 }}>
            💰 Donations
          </button>
        </div>
      </section>

      <div style={{ height: 18 }} />

      <section className="card">
        <h2 style={{ marginTop: 0 }}>My Stat Book</h2>

        {myBooster ? (
          <p style={{ marginTop: 6, opacity: 0.9 }}>
            Selected booster: <b>{myBooster.name}</b> ({myBooster.school})
          </p>
        ) : (
          <p style={{ marginTop: 6, opacity: 0.85 }}>No booster selected yet.</p>
        )}

        {statsLoading ? (
          <p style={{ marginTop: 10, opacity: 0.85 }}>Loading your official results...</p>
        ) : statsError ? (
          <p style={{ marginTop: 10, opacity: 0.85 }}>
            Could not load your official results: {statsError}
          </p>
        ) : myAccuracy ? (
          <>
            <p style={{ margin: "6px 0" }}>
              🎯 Booster Bowl Rating (completed games): <b>{myAccuracy.percent}%</b>
            </p>
            <p style={{ margin: "6px 0" }}>
              📊 Correct Picks: <b>{myAccuracy.correct}</b> / {myAccuracy.total}
            </p>
          </>
        ) : (
          <p style={{ marginTop: 10, opacity: 0.85 }}>
            No completed picks yet — your rating will appear after a game is final.
          </p>
        )}

        {myTeam ? (
          <>
            <ProgressBar value={myTeam.donationsTotal} max={myTeam.goal} />
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="button" onClick={() => addDonation(10)}>+$10 Demo Donation</button>
              <button className="button" onClick={() => addDonation(25)}>+$25 Demo Donation</button>
              <button className="button" onClick={() => addDonation(100)}>+$100 Demo Donation</button>
            </div>
            <div style={{ marginTop: 10, opacity: 0.85 }}>
              Unlocked incentives: <b>{myTeam.incentives.length ? myTeam.incentives.join(" • ") : "— none yet"}</b>
            </div>
          </>
        ) : null}
      </section>

      <div style={{ height: 18 }} />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {sortedBoosters.map((b, index) => (
          <div key={`booster-${b.id}`} className="card">
            <h3 style={{ marginTop: 0 }}>#{index + 1} — {b.name}</h3>
            <p style={{ margin: "6px 0" }}>
              🎯 Booster Bowl Rating: <b>{b.rating}%</b>{teamStatsLive ? " (live)" : ""}
            </p>
            <p style={{ margin: "6px 0" }}>👥 Supporters: <b>{b.supporters}</b></p>
            <p style={{ margin: "6px 0" }}>📊 Total Picks: <b>{b.totalPicks}</b></p>

            {teamStatsLive ? (
              <p style={{ margin: "6px 0" }}>
                ✅ Completed Picks: <b>{b.correctPicks}</b> / {b.completedPicks}
              </p>
            ) : null}

            <p style={{ margin: "6px 0" }}>
              💰 Donations: <b>${b.donationsTotal.toLocaleString()}</b>
              {b.extraDonation ? (
                <span style={{ opacity: 0.8 }}> (includes +${b.extraDonation.toLocaleString()} demo)</span>
              ) : null}
            </p>

            <ProgressBar value={b.donationsTotal} max={b.goal} />

            <div style={{ marginTop: 10, opacity: 0.85 }}>
              Incentives: <b>{b.incentives.length ? b.incentives.join(" • ") : "— not unlocked yet"}</b>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
