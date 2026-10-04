-- Resolve the user-facing contest week automatically from the live schedule.
-- A week remains current through its final scheduled kickoff plus 12 hours so
-- My Picks and the weekly leaderboard do not roll forward during live games.
-- The picks deadline remains the FIRST kickoff and is enforced separately by
-- supabase/enforce_pick_deadline.sql.

create or replace function public.get_active_contest_week(p_season integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with week_windows as (
    select
      g.week,
      min(g.kickoff_at) as first_kickoff,
      max(g.kickoff_at) as last_kickoff
    from public.games g
    where g.season = p_season
      and g.kickoff_at is not null
      and coalesce(g.sync_status, 'scheduled') = 'scheduled'
    group by g.week
  )
  select coalesce(
    (
      select min(w.week)
      from week_windows w
      where now() < w.last_kickoff + interval '12 hours'
    ),
    (select max(w.week) from week_windows w)
  );
$$;

revoke all on function public.get_active_contest_week(integer) from public;
grant execute on function public.get_active_contest_week(integer) to anon, authenticated;
