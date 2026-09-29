import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { CURRENT_WEEK } from "../lib/config";

const SEASON = 2026;

export default function AdminScores() {
  const [user, setUser] = useState(null);
  const [games, setGames] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadGames() {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.from("games").select("id,away_team,home_team,away_score,home_score,winner,is_final,kickoff_at,season,week").eq("season", SEASON).eq("week", CURRENT_WEEK).order("id");
    if (error) { setMessage("Could not load games: " + error.message); setLoading(false); return; }
    setGames(data || []);
    const next = {};
    (data || []).forEach((g) => { next[g.id] = { away: g.away_score ?? "", home: g.home_score ?? "" }; });
    setDrafts(next);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    loadGames();
  }, []);

  const completed = useMemo(() => games.filter((g) => g.is_final).length, [games]);

  function setScore(id, side, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || {}), [side]: value } }));
  }

  async function saveFinal(game) {
    if (!user) return setMessage("Sign in first. Score updates are protected by Supabase permissions.");
    const draft = drafts[game.id] || {};
    if (draft.away === "" || draft.home === "") return setMessage("Enter both scores before marking a game final.");
    const awayScore = Number(draft.away), homeScore = Number(draft.home);
    if (!Number.isInteger(awayScore) || !Number.isInteger(homeScore) || awayScore < 0 || homeScore < 0) return setMessage("Scores must be whole numbers of 0 or greater.");
    if (awayScore === homeScore) return setMessage("A final football game needs a winner; tied scores cannot be finalized.");
    const winner = awayScore > homeScore ? game.away_team : game.home_team;
    if (!window.confirm(`Finalize ${game.away_team} ${awayScore} — ${game.home_team} ${homeScore}? Winner: ${winner}. This immediately affects leaderboard scoring.`)) return;
    setSavingId(game.id); setMessage("");
    const { data, error } = await supabase.rpc("admin_finalize_game", {
      p_game_id: game.id,
      p_season: SEASON,
      p_week: CURRENT_WEEK,
      p_away_score: awayScore,
      p_home_score: homeScore,
    });
    setSavingId(null);
    if (error) return setMessage("Score was NOT saved: " + error.message);
    if (!data || data.is_final !== true || Number(data.id) !== Number(game.id)) return setMessage("Score was NOT confirmed by the database. Refresh and verify before continuing.");
    setMessage(`✅ Final saved: ${winner} won ${Math.max(awayScore, homeScore)}–${Math.min(awayScore, homeScore)}. Leaderboard scoring will use this result.`);
    await loadGames();
  }

  async function reopen(game) {
    if (!user) return setMessage("Sign in first.");
    setMessage("Reopening finalized games is temporarily disabled while the secure admin reopen function is being added.");
  }

  return <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
    <section className="card">
      <h1 style={{ marginTop: 0 }}>🏈 Score Admin</h1>
      <p>Season {SEASON} — Week {CURRENT_WEEK}</p>
      <p style={{ opacity: .8 }}>Enter both scores, verify them, then finalize. The winner is calculated automatically.</p>
      <p><b>{completed} / {games.length}</b> games final</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Link href="/leaderboard" className="button">Leaderboard</Link><button className="button" onClick={loadGames}>Refresh</button></div>
      {message ? <p style={{ marginTop: 14, padding: 12, border: "1px solid #cbd5e1", borderRadius: 12 }}>{message}</p> : null}
    </section>
    <div style={{ height: 18 }} />
    {loading ? <section className="card"><p>Loading games...</p></section> : games.map((g, index) => <section className="card" key={g.id} style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, opacity: .7 }}>GAME {index + 1} OF {games.length} • ID {g.id}</div>
      <h2 style={{ marginBottom: 8 }}>{g.away_team} at {g.home_team}</h2>
      {g.is_final ? <p>✅ <b>FINAL:</b> {g.away_team} {g.away_score} — {g.home_team} {g.home_score}<br/>Winner: <b>{g.winner}</b></p> : <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10, alignItems: "center" }}>
        <label><b>{g.away_team}</b></label><input inputMode="numeric" value={drafts[g.id]?.away ?? ""} onChange={(e) => setScore(g.id, "away", e.target.value)} placeholder="Score" style={{ padding: 12, width: "100%", boxSizing: "border-box" }}/>
        <label><b>{g.home_team}</b></label><input inputMode="numeric" value={drafts[g.id]?.home ?? ""} onChange={(e) => setScore(g.id, "home", e.target.value)} placeholder="Score" style={{ padding: 12, width: "100%", boxSizing: "border-box" }}/>
      </div>}
      <div style={{ marginTop: 14 }}>{g.is_final ? <button className="button" disabled={savingId === g.id} onClick={() => reopen(g)}>Correct / Reopen</button> : <button className="button" disabled={savingId === g.id} onClick={() => saveFinal(g)}>{savingId === g.id ? "Saving..." : "Finalize Result"}</button>}</div>
    </section>)}
  </main>;
}
