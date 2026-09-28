import { getServerSupabase } from "../../../lib/serverSupabase";

function cronAuthorized(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return (req.headers.authorization || "") === `Bearer ${expected}`;
}

function normalizeFeedGame(raw, source, season, week) {
  const away = String(raw.away_team || raw.away || "").trim();
  const home = String(raw.home_team || raw.home || "").trim();
  const sourceGameId = String(raw.source_game_id || raw.id || "").trim();
  if (!away || !home || !sourceGameId) return null;

  return {
    season: Number(raw.season ?? season),
    week: Number(raw.week ?? week),
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
    source,
    source_game_id: sourceGameId,
    source_url: raw.source_url || null,
    synced_at: new Date().toISOString(),
    sync_status: raw.sync_status || "active",
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!cronAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const feedUrl = process.env.SCHEDULE_FEED_URL;
  if (!feedUrl) return res.status(503).json({ error: "SCHEDULE_FEED_URL is not configured." });

  const response = await fetch(feedUrl, {
    headers: process.env.SCHEDULE_FEED_TOKEN
      ? { Authorization: `Bearer ${process.env.SCHEDULE_FEED_TOKEN}` }
      : {},
  });

  if (!response.ok) {
    return res.status(502).json({ error: `Schedule feed returned ${response.status}` });
  }

  const payload = await response.json();
  const source = String(payload.source || process.env.SCHEDULE_FEED_NAME || "schedule-feed");
  const season = Number(payload.season);
  const week = Number(payload.week);
  const rawGames = Array.isArray(payload.games) ? payload.games : [];

  if (!Number.isInteger(season) || !Number.isInteger(week) || !rawGames.length) {
    return res.status(502).json({ error: "Schedule feed payload is missing season, week, or games." });
  }

  const games = rawGames.map((g) => normalizeFeedGame(g, source, season, week)).filter(Boolean);
  if (!games.length) return res.status(502).json({ error: "Schedule feed contained no valid games." });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("games")
    .upsert(games, { onConflict: "source,source_game_id" })
    .select("id");

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    ok: true,
    source,
    season,
    week,
    synced: data?.length || 0,
  });
}
