import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CURRENT_WEEK, SEASON } from "../lib/config";

export default function MyPicks() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => { loadPicks(); }, []);

  async function loadPicks() {
    setLoading(true);
    setMessage("");

    const { data: authData } = await supabase.auth.getUser();
    const signedInUser = authData?.user;
    setUser(signedInUser || null);
    if (!signedInUser) {
      setMessage("Sign in on Make Picks first to view your saved picks.");
      setLoading(false);
      return;
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id,display_name")
      .eq("user_id", signedInUser.id)
      .single();

    if (playerError || !player) {
      setMessage("We could not find your Booster Bowl player profile yet.");
      setLoading(false);
      return;
    }

    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id,away_team,home_team,winner")
      .eq("season", Number(SEASON))
      .eq("week", CURRENT_WEEK);

    if (gamesError) {
      setMessage("Could not load this week's games: " + gamesError.message);
      setLoading(false);
      return;
    }

    const gameMap = new Map((games || []).map((g) => [g.id, g]));
    const gameIds = (games || []).map((g) => g.id);
    if (!gameIds.length) {
      setMessage("This week's games have not been loaded yet.");
      setLoading(false);
      return;
    }

    const { data: picks, error: picksError } = await supabase
      .from("picks")
      .select("id,game_id,selected_team,created_at")
      .eq("player_id", player.id)
      .in("game_id", gameIds);

    if (picksError) {
      setMessage("Could not load your picks: " + picksError.message);
      setLoading(false);
      return;
    }

    setRows((picks || []).map((pick) => ({ ...pick, game: gameMap.get(pick.game_id) })).filter((r) => r.game));
    setLoading(false);
  }

  const completed = rows.filter((r) => r.game?.winner);
  const correct = completed.filter((r) => r.selected_team === r.game.winner).length;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>🏈 My Picks</h1>
        <p style={{ opacity: 0.85 }}>2026 • Week {CURRENT_WEEK}</p>
        {user ? <p style={{ fontWeight: 700 }}>✅ Signed in as {user.email}</p> : null}
        {completed.length ? <p style={{ fontSize: 20 }}>Your record: <b>{correct}-{completed.length - correct}</b> ({correct}/{completed.length} correct)</p> : <p>Results will grade automatically as game winners are entered.</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/picks" className="button">Make Picks</Link>
          <Link href="/leaderboard" className="button">Leaderboard</Link>
          <Link href="/" className="button">Home</Link>
        </div>
        {message ? <div style={{ marginTop: 14, padding: 12, border: "1px solid #2a3b57", borderRadius: 12 }}>{message}</div> : null}
      </section>

      <div style={{ height: 18 }} />
      {loading ? <section className="card">Loading your picks...</section> : null}
      {!loading && !message && rows.length === 0 ? <section className="card">No saved picks found for Week {CURRENT_WEEK}.</section> : null}
      {rows.map((row, index) => {
        const winner = row.game.winner;
        const isCorrect = winner ? row.selected_team === winner : null;
        return (
          <section className="card" key={row.id} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}>GAME {index + 1}</div>
            <h2 style={{ marginBottom: 8 }}>{row.game.away_team} <span style={{ opacity: 0.6 }}>at</span> {row.game.home_team}</h2>
            <p>Your pick: <b>{row.selected_team}</b></p>
            {!winner ? <p style={{ fontWeight: 700 }}>⏳ Awaiting result</p> : isCorrect ? <p style={{ fontWeight: 700 }}>✅ Correct • Winner: {winner}</p> : <p style={{ fontWeight: 700 }}>❌ Incorrect • Winner: {winner}</p>}
          </section>
        );
      })}
    </main>
  );
}
