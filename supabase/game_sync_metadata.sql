-- Booster Bowl weekly game sync metadata
-- Mirrors the production-safe SQL installed manually in Supabase.
-- Safe to run more than once.

alter table public.games
  add column if not exists source text,
  add column if not exists source_game_id text,
  add column if not exists source_url text,
  add column if not exists synced_at timestamptz,
  add column if not exists sync_status text default 'active';

create unique index if not exists games_source_game_unique
on public.games (source, source_game_id)
where source is not null
  and source_game_id is not null;

create index if not exists games_season_week_idx
on public.games (season, week);

create index if not exists games_season_week_district_idx
on public.games (season, week, district);

create index if not exists games_season_week_region_idx
on public.games (season, week, away_region, home_region);

create index if not exists games_season_week_class_idx
on public.games (season, week, away_class, home_class);
