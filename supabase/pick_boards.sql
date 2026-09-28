-- Booster Bowl dynamic pick-board metadata
-- Run once in the Supabase SQL Editor.
-- Existing games remain valid; all new columns are nullable so current scoring
-- and existing picks continue to work unchanged.

alter table public.games add column if not exists sport text default 'football';
alter table public.games add column if not exists district text;
alter table public.games add column if not exists home_class text;
alter table public.games add column if not exists home_region text;
alter table public.games add column if not exists away_class text;
alter table public.games add column if not exists away_region text;
alter table public.games add column if not exists is_featured boolean not null default false;
alter table public.games add column if not exists source_name text;
alter table public.games add column if not exists source_url text;
alter table public.games add column if not exists kickoff_at timestamptz;

create index if not exists games_season_week_district_idx on public.games (season, week, district);
create index if not exists games_season_week_featured_idx on public.games (season, week, is_featured);

-- Safe authenticated read function for the current pick-board catalog.
create or replace function public.get_pick_board_games(p_season integer, p_week integer)
returns table (
  id bigint,
  away_team text,
  home_team text,
  kickoff_at timestamptz,
  sport text,
  district text,
  away_class text,
  away_region text,
  home_class text,
  home_region text,
  is_featured boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.away_team, g.home_team, g.kickoff_at, g.sport, g.district,
         g.away_class, g.away_region, g.home_class, g.home_region, g.is_featured
  from public.games g
  where g.season = p_season and g.week = p_week
  order by coalesce(g.kickoff_at, 'infinity'::timestamptz), g.away_team, g.home_team;
$$;

revoke all on function public.get_pick_board_games(integer, integer) from public;
grant execute on function public.get_pick_board_games(integer, integer) to authenticated;
