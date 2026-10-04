-- Enforce the weekly pick deadline inside Postgres.
-- Run this once in the Supabase SQL Editor. The browser also shows the same
-- deadline, but this trigger is the authoritative protection against late picks.

create or replace function public.enforce_pick_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season integer;
  v_week integer;
  v_first_kickoff timestamptz;
begin
  -- Keep service-role maintenance and migrations possible.
  if auth.role() = 'service_role' then
    return new;
  end if;

  select g.season, g.week
    into v_season, v_week
  from public.games g
  where g.id = new.game_id;

  if not found then
    raise exception 'The selected game does not exist';
  end if;

  select min(g.kickoff_at)
    into v_first_kickoff
  from public.games g
  where g.season = v_season
    and g.week = v_week
    and coalesce(g.sync_status, 'scheduled') = 'scheduled';

  if v_first_kickoff is null then
    raise exception 'Picks are locked until kickoff times are published';
  end if;

  if now() >= v_first_kickoff then
    raise exception 'Picks are locked for Week % because the first kickoff has passed', v_week;
  end if;

  return new;
end;
$$;

drop trigger if exists picks_enforce_deadline on public.picks;
create trigger picks_enforce_deadline
before insert or update of game_id, selected_team
on public.picks
for each row execute function public.enforce_pick_deadline();

revoke all on function public.enforce_pick_deadline() from public;
