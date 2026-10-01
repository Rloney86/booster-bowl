-- Keep stale/ambiguous schedule rows for auditability and existing pick references,
-- but never expose them as selectable Pick Board games.
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
  where g.season = p_season
    and g.week = p_week
    and coalesce(g.sync_status, 'scheduled') = 'scheduled'
  order by coalesce(g.kickoff_at, 'infinity'::timestamptz), g.away_team, g.home_team;
$$;

revoke all on function public.get_pick_board_games(integer, integer) from public;
grant execute on function public.get_pick_board_games(integer, integer) to authenticated;
