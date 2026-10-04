import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { CURRENT_WEEK } from "../lib/config";
import { resolveActiveWeek } from "../lib/activeWeek";

const BOOSTER_KEY = "bb_selected_booster";
const SEASON = 2026;

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

function calculateAccuracy(picks, games) {
  const winners = new Map((games || []).filter((g) => g.is_final && g.winner).map((g) => [String(g.id), g.winner]));
  const completed = (picks || []).filter((p) => winners.has(String(p.game_id)));
  const correct = completed.filter((p) => p.selected_team === winners.get(String(p.game_id))).length;
  const total = completed.length;
  return { correct, total, percent: total ? Math.round((correct / total) * 100) : 0 };
}

export default function Leaderboard() {
  const [myBooster, setMyBooster] = useState(null);
  const [activeWeek, setActiveWeek] = useState(CURRENT_WEEK);
  const [mySeasonAccuracy, setMySeasonAccuracy] = useState(null);
  const [myWeekAccuracy, setMyWeekAccuracy] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [seasonStats, setSeasonStats] = useState([]);
  const [weekStats, setWeekStats] = useState([]);
  const [view, setView] = useState("week");
  const [teamStatsLive, setTeamStatsLive] = useState(false);
  const [teamStatsMessage, setTeamStatsMessage] = useState("");
  const [sortBy, setSortBy] = useState("rating");

  useEffect(() => {
    const b = safeParseJSON(localStorage.getItem(BOOSTER_KEY), null);
    if (b) setMyBooster(b);
    let cancelled = false;

    async function loadLeaderboards(week) {
      try {
        const [seasonResult, weekResult] = await Promise.all([
          supabase.rpc("get_booster_leaderboard"),
          supabase.rpc("get_booster_leaderboard_week", { p_season: SEASON, p_week: week }),
        ]);
        if (seasonResult.error) throw seasonResult.error;
        if (weekResult.error) throw weekResult.error;
        if (!cancelled) {
          setSeasonStats(seasonResult.data || []);
          setWeekStats(weekResult.data || []);
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

    async function loadMyStats(week) {
      setStatsLoading(true);
      setStatsError("");
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const user = userData?.user;
        if (!user) return;

        const { data: player, error: playerError } = await supabase.from("players").select("id,booster_name,school_name").eq("user_id", user.id).maybeSingle();
        if (playerError) throw playerError;
        if (!player) return;

        if (!cancelled && player.booster_name) {
          const persistedBooster = { name: player.booster_name, school: player.school_name || "" };
          setMyBooster(persistedBooster);
          try { localStorage.setItem(BOOSTER_KEY, JSON.stringify(persistedBooster)); } catch {}
        }

        const { data: savedPicks, error: picksError } = await supabase.from("picks").select("game_id,selected_team").eq("player_id", player.id);
        if (picksError) throw picksError;
        if (!savedPicks?.length) return;

        const gameIds = [...new Set(savedPicks.map((p) => p.game_id))];
        const { data: games, error: gamesError } = await supabase.from("games").select("id,winner,is_final,season,week").in("id", gameIds);
        if (gamesError) throw gamesError;

        const seasonGames = (games || []).filter((g) => Number(g.season) === SEASON);
        const weekGames = seasonGames.filter((g) => Number(g.week) === Number(week));
        const seasonIds = new Set(seasonGames.map((g) => String(g.id)));
        const weekIds = new Set(weekGames.map((g) => String(g.id)));
        const seasonPicks = savedPicks.filter((p) => seasonIds.has(String(p.game_id)));
        const weekPicks = savedPicks.filter((p) => weekIds.has(String(p.game_id)));

        if (!cancelled) {
          setMySeasonAccuracy(calculateAccuracy(seasonPicks, seasonGames));
          setMyWeekAccuracy(calculateAccuracy(weekPicks, weekGames));
        }
      } catch (error) {
        if (!cancelled) setStatsError(error?.message || "Unable to load results.");
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    async function initialize() {
      const week = await resolveActiveWeek();
      if (cancelled) return;
      setActiveWeek(week);
      await Promise.all([loadLeaderboards(week), loadMyStats(week)]);
    }

    initialize();
    return () => { cancelled = true; };
  }, []);

  const activeStats = view === "week" ? weekStats : seasonStats;
  const myAccuracy = view === "week" ? myWeekAccuracy : mySeasonAccuracy;
  const statLabel = view === "week" ? `Week ${activeWeek}` : "Season";
  const liveByName = useMemo(() => new Map((activeStats || []).map((row) => [row.booster_name, row])), [activeStats]);

  const computedBoosters = useMemo(() => BOOSTERS.map((b) => {
    const live = liveByName.get(b.name);
    return { ...b, school: live?.school_name || b.school, supporters: Number(live?.supporters || 0), totalPicks: Number(live?.total_picks || 0), completedPicks: Number(live?.completed_picks || 0), correctPicks: Number(live?.correct_picks || 0), rating: Number(live?.accuracy_percent || 0) };
  }), [liveByName]);

  const sortedBoosters = useMemo(() => {
    const arr = [...new Map(computedBoosters.map((b) => [b.id, b])).values()];
    if (sortBy === "rating") arr.sort((a, b) => (b.rating - a.rating) || (b.correctPicks - a.correctPicks) || (b.supporters - a.supporters) || a.name.localeCompare(b.name));
    else arr.sort((a, b) => (b.supporters - a.supporters) || (b.totalPicks - a.totalPicks) || (b.rating - a.rating) || a.name.localeCompare(b.name));
    return arr;
  }, [computedBoosters, sortBy]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Booster Bowl Leaderboard</h1>
        <p style={{ opacity: 0.9 }}>Season {SEASON} — {view === "week" ? `Week ${activeWeek} Standings` : "Season Standings"}</p>
        {teamStatsMessage ? <p style={{ marginTop: 8, opacity: 0.75 }}>{teamStatsMessage}</p> : null}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}><Link href="/" className="button">← Back Home</Link><Link href="/booster" className="button">Choose Booster</Link><Link href="/picks" className="button">Make Picks</Link></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}><button className="button" onClick={() => setView("week")} style={{ opacity: view === "week" ? 1 : 0.65 }}>🏈 Week {activeWeek}</button><button className="button" onClick={() => setView("season")} style={{ opacity: view === "season" ? 1 : 0.65 }}>🏆 Season</button></div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><div style={{ opacity: 0.9 }}>Sort by:</div><button className="button" onClick={() => setSortBy("rating")} style={{ opacity: sortBy === "rating" ? 1 : 0.65 }}>🎯 Rating</button><button className="button" onClick={() => setSortBy("activity")} style={{ opacity: sortBy === "activity" ? 1 : 0.65 }}>👥 Activity</button></div>
      </section>

      <div style={{ height: 18 }} />
      <section className="card">
        <h2 style={{ marginTop: 0 }}>My Stat Book</h2>
        {myBooster ? <p style={{ marginTop: 6, opacity: 0.9 }}>Selected booster: <b>{myBooster.name}</b> ({myBooster.school})</p> : <p style={{ marginTop: 6, opacity: 0.85 }}>No booster selected yet.</p>}
        {statsLoading ? <p style={{ marginTop: 10, opacity: 0.85 }}>Loading your official results...</p> : statsError ? <p style={{ marginTop: 10, opacity: 0.85 }}>Could not load your official results: {statsError}</p> : myAccuracy?.total ? <><p style={{ margin: "6px 0" }}>🎯 {statLabel} Rating (completed games): <b>{myAccuracy.percent}%</b></p><p style={{ margin: "6px 0" }}>📊 Correct Picks: <b>{myAccuracy.correct}</b> / {myAccuracy.total}</p></> : <p style={{ marginTop: 10, opacity: 0.85 }}>No completed {statLabel.toLowerCase()} picks yet — your rating will appear after a game is final.</p>}
      </section>

      <div style={{ height: 18 }} />
      {!teamStatsLive ? <section className="card"><p style={{ margin: 0 }}>Live team standings are temporarily unavailable.</p></section> : null}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {sortedBoosters.map((b, index) => <div key={`booster-${b.id}`} className="card"><h3 style={{ marginTop: 0 }}>#{index + 1} — {b.name}</h3><p style={{ margin: "6px 0", opacity: 0.8 }}>{b.school}</p><p style={{ margin: "6px 0" }}>🎯 {statLabel} Rating: <b>{b.rating}%</b></p><p style={{ margin: "6px 0" }}>👥 Supporters: <b>{b.supporters}</b></p><p style={{ margin: "6px 0" }}>📊 Total Picks: <b>{b.totalPicks}</b></p><p style={{ margin: "6px 0" }}>✅ Completed Picks: <b>{b.correctPicks}</b> / {b.completedPicks}</p></div>)}
      </section>
    </main>
  );
}
