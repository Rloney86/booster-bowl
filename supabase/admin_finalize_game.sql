-- Secure score finalization for Booster Bowl.
-- Apply this migration in Supabase before using pages/admin.js.
--
-- IMPORTANT: replace the email below if the production admin account changes.

create or replace function public.admin_finalize_game(
  p_game_id bigint,
  p_season integer,
  p_week integer,
  p_away_score integer,
  p_home_score integer
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select email into v_email
  from auth.users
  where id = auth.uid();

  if lower(coalesce(v_email, '')) <> 'mr.rayloney@gmail.com' then
    raise exception 'Admin access required';
  end if;

  if p_away_score is null or p_home_score is null
     or p_away_score < 0 or p_home_score < 0 then
    raise exception 'Scores must be whole numbers of 0 or greater';
  end if;

  if p_away_score = p_home_score then
    raise exception 'Tied scores cannot be finalized';
  end if;

  select * into v_game
  from public.games
  where id = p_game_id
    and season = p_season
    and week = p_week
  for update;

  if not found then
    raise exception 'Game not found for the requested season and week';
  end if;

  if v_game.is_final then
    raise exception 'Game is already final';
  end if;

  update public.games
  set away_score = p_away_score,
      home_score = p_home_score,
      is_final = true
  where id = p_game_id
    and season = p_season
    and week = p_week
  returning * into v_game;

  return v_game;
end;
$$;

revoke all on function public.admin_finalize_game(bigint, integer, integer, integer, integer) from public;
revoke all on function public.admin_finalize_game(bigint, integer, integer, integer, integer) from anon;
grant execute on function public.admin_finalize_game(bigint, integer, integer, integer, integer) to authenticated;


-- Let the admin page verify access without exposing account details.
create or replace function public.admin_is_authorized()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and lower(coalesce(email, '')) = 'mr.rayloney@gmail.com'
  );
$$;

revoke all on function public.admin_is_authorized() from public;
revoke all on function public.admin_is_authorized() from anon;
grant execute on function public.admin_is_authorized() to authenticated;

-- Reopen a finalized game so an incorrect score can be corrected safely.
-- Clearing the scores and is_final also clears winner through games_set_winner.
create or replace function public.admin_reopen_game(
  p_game_id bigint,
  p_season integer,
  p_week integer
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select email into v_email
  from auth.users
  where id = auth.uid();

  if lower(coalesce(v_email, '')) <> 'mr.rayloney@gmail.com' then
    raise exception 'Admin access required';
  end if;

  select * into v_game
  from public.games
  where id = p_game_id
    and season = p_season
    and week = p_week
  for update;

  if not found then
    raise exception 'Game not found for the requested season and week';
  end if;

  if not v_game.is_final then
    raise exception 'Game is not final';
  end if;

  update public.games
  set away_score = null,
      home_score = null,
      is_final = false
  where id = p_game_id
    and season = p_season
    and week = p_week
  returning * into v_game;

  return v_game;
end;
$$;

revoke all on function public.admin_reopen_game(bigint, integer, integer) from public;
revoke all on function public.admin_reopen_game(bigint, integer, integer) from anon;
grant execute on function public.admin_reopen_game(bigint, integer, integer) to authenticated;


-- Verified schedule correction: this imported matchup did not exist.
-- Quarantine rather than delete so any historical references remain auditable.
update public.games
set sync_status = 'quarantined',
    is_featured = false
where id = 36
  and lower(trim(away_team)) = 'landstown'
  and lower(trim(home_team)) = 'huguenot'
  and is_final = false;
