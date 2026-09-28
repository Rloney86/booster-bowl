import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const BOOSTER_KEY = "bb_selected_booster";

const BOOSTERS = [
  { id: "jmhs", name: "Big Blue Boosters", school: "John Marshall High School" },
  { id: "hsprings", name: "Springers Booster Club", school: "Highland Springs High School" },
  { id: "varina", name: "Blue Devils Boosters", school: "Varina High School" },
  { id: "maury", name: "Maury Boosters", school: "Maury High School" },
  { id: "glenallen", name: "Jaguar Nation", school: "Glen Allen High School" },
];

function safeParseJSON(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
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

  useEffect(() => {
    const b = safeParseJSON(localStorage.getItem(BOOSTER_KEY), null);
    if (b) setMyBooster(b);
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
      } catch (error) {
        if (!cancelled) {
          setTeamStatsLive(false);
          setTeamStatsMessage(error?.message || "Unable to load live team standings.");
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
          .from("players").select("id").eq("user_id", user.id).maybeSingle();
        if (playerError) throw playerError;
        if (!player) return;

        const { data: savedPicks, error: picksError } = await supabase
          .from("picks").select("game_id,selected_team").eq("player_id", player.id);
        if (picksError) throw picksError;
        if (!savedPicks?.length) return;

        const gameIds = [...new Set(savedPicks.map((p) => p.game_id))];
        const { data: finalGames, error: gamesError } = await supabase
          .from("games").select("id,winner,is_final").in("id", gameIds).eq("is_final", true);
        if (gamesError) throw gamesError;

        const winners = new Map((finalGames || []).map((g) => [String(g.id), g.winner]));
        const completedPicks = savedPicks.filter((p) => winners.has(String(p.game_id)));
        const correct = completedPicks.filter((p) => p.selected_team === winners.get(String(p.game_id))).length;
        const total = completedPicks.length;
        if (!cancelled) setMyAccuracy({ correct, total, percent: total ? Math.round((correct / total) * 100) : 0 });
      } catch (error) {
        if (!cancelled) setStatsError(error?.message || "Unable to load results.");
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    loadLeaderboard();
    loadMyStats();
    return () => { cancelled = true; };
  }, []);

  const liveByName = useMemo(() => new Map((teamStats || []).map((row) => [row.booster_name, row])), [teamStats]);

  const computedBoosters = useMemo(() => BOOSTERS.map((b) => {
    const live = liveByName.get(b.name);
    return {
      ...b,
      school: live?.school_name || b.school,
      supporters: Number(live?.supporters || 0),
      totalPicks: Number(live?.total_picks || 0),
      completedPicks: Number(live?.completed_picks || 0),
      correctPicks: Number(live?.correct_picks || 0),
      rating: Number(live?.accuracy_percent || 0),
    };
  }), [liveByName]);

  const sortedBoosters = useMemo(() => {
    // Defensive de-dupe: one rendered card per canonical booster id.
    const arr = [...new Map(computedBoosters.map((b) => [b.id, b])).values()];
    if (sortBy === "rating") {
      arr.sort((a, b) => (b.rating - a.rating) || (b.correctPicks - a.correctPicks) || (b.supporters - a.supporters) || a.name.localeCompare(b.name));
    } else {
      arr.sort((a, b) => (b.supporters - a.supporters) || (b.totalPicks - a.totalPicks) || (b.rating - a.rating) || a.name.localeCompare(b.name));
    }
    return arr;
  }, [computedBoosters, sortBy]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Booster Bowl Leaderboard</h1>
        <p style={{ opacity: 0.9 }}>Season 2026 — Live Team Standings</p>
        {teamStatsMessage ? <p style={{ marginTop: 8, opacity: 0.75 }}>{teamStatsMessage}</p> : null}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <Link href="/" className="button">← Back Home</Link>
          <Link href="/booster" className="button">Choose Booster</Link>
          <Link href="/picks" className="button">Make Picks</Link>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ opacity: 0.9 }}>Sort by:</div>
          <button className="button" onClick={() => setSortBy("rating")} style={{ opacity: sortBy === "rating" ? 1 : 0.75 }}>🎯 Rating</button>
          <button className="button" onClick={() => setSortBy("activity")} style={{ opacity: sortBy === "activity" ? 1 : 0.75 }}>👥 Activity</button>
        </div>
      </section>

      <div style={{ height: 18 }} />
      <section className="card">
        <h2 style={{ marginTop: 0 }}>My Stat Book</h2>
        {myBooster ? <p style={{ marginTop: 6, opacity: 0.9 }}>Selected booster: <b>{myBooster.name}</b> ({myBooster.school})</p> : <p style={{ marginTop: 6, opacity: 0.85 }}>No booster selected yet.</p>}
        {statsLoading ? <p style={{ marginTop: 10, opacity: 0.85 }}>Loading your official results...</p>
          : statsError ? <p style={{ marginTop: 10, opacity: 0.85 }}>Could not load your official results: {statsError}</p>
          : myAccuracy ? <>
              <p style={{ margin: "6px 0" }}>🎯 Booster Bowl Rating (completed games): <b>{myAccuracy.percent}%</b></p>
              <p style={{ margin: "6px 0" }}>📊 Correct Picks: <b>{myAccuracy.correct}</b> / {myAccuracy.total}</p>
            </>
          : <p style={{ marginTop: 10, opacity: 0.85 }}>No completed picks yet — your rating will appear after a game is final.</p>}
      </section>

      <div style={{ height: 18 }} />
      {!teamStatsLive ? <section className="card"><p style={{ margin: 0 }}>Live team standings are temporarily unavailable.</p></section> : null}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {sortedBoosters.map((b, index) => (
          <div key={`booster-${b.id}`} className="card">
            <h3 style={{ marginTop: 0 }}>#{index + 1} — {b.name}</h3>
            <p style={{ margin: "6px 0", opacity: 0.8 }}>{b.school}</p>
            <p style={{ margin: "6px 0" }}>🎯 Booster Bowl Rating: <b>{b.rating}%</b></p>
            <p style={{ margin: "6px 0" }}>👥 Supporters: <b>{b.supporters}</b></p>
            <p style={{ margin: "6px 0" }}>📊 Total Picks: <b>{b.totalPicks}</b></p>
            <p style={{ margin: "6px 0" }}>✅ Completed Picks: <b>{b.correctPicks}</b> / {b.completedPicks}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
