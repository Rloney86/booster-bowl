import { getServerSupabase } from "../../../lib/serverSupabase";

function authorized(req) {
  const expected = process.env.BOOSTER_BOWL_SYNC_SECRET;
  if (!expected) return false;
  const header = req.headers.authorization || "";
  return header === `Bearer ${expected}`;
}

function normalizeGame(raw, defaultSeason, defaultWeek, defaultSource) {
  if (!raw) return null;
  const away = String(raw.away_team || raw.away || "").trim();
  const home = String(raw.home_team || raw.home || "").trim();
  const sourceGameId = String(raw.source_game_id || raw.id || "").trim();

  if (!away || !home || !sourceGameId) return null;

  return {
    season: Number(raw.season ?? defaultSeason),
    week: Number(raw.week ?? defaultWeek),
    away_team: away,
    home_team: home,
    kickoff_at: raw.kickoff_at || raw.kickoff || null,
    sport: raw.sport || "football",
    district: raw.district || null,
    away_class: raw.away_class || null,
    away_region: raw.away_region || null,
    home_class: raw.home_class || null,
    home_region: raw.home_region || null,
    is_featured: Boolean(raw.is_featured),
    away_score: raw.away_score ?? null,
    home_score: raw.home_score ?? null,
    is_final: Boolean(raw.is_final),
    source: raw.source || defaultSource,
    source_game_id: sourceGameId,
    source_url: raw.source_url || null,
    synced_at: new Date().toISOString(),
    sync_status: raw.sync_status || "active",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!authorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body || {};
  const source = String(body.source || "schedule-feed").trim();
  const season = Number(body.season);
  const week = Number(body.week);
  const rawGames = Array.isArray(body.games) ? body.games : [];

  if (!Number.isInteger(season) || !Number.isInteger(week) || week < 1) {
    return res.status(400).json({ error: "Valid season and week are required." });
  }
  if (!rawGames.length) {
    return res.status(400).json({ error: "games must contain at least one matchup." });
  }

  const games = rawGames
    .map((g) => normalizeGame(g, season, week, source))
    .filter(Boolean);

  if (!games.length) {
    return res.status(400).json({ error: "No valid games were supplied." });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("games")
    .upsert(games, { onConflict: "source,source_game_id" })
    .select("id,season,week,away_team,home_team,source,source_game_id");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    ok: true,
    season,
    week,
    received: rawGames.length,
    synced: data?.length || 0,
    games: data || [],
  });
}
