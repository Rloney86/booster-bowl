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


-- Allow the authorized score admin to quarantine a non-final invalid matchup
-- without deleting the game or any pick references.
create or replace function public.admin_quarantine_game(
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

  if v_game.is_final then
    raise exception 'Final games must be reopened before they can be quarantined';
  end if;

  update public.games
  set sync_status = 'quarantined',
      is_featured = false
  where id = p_game_id
    and season = p_season
    and week = p_week
  returning * into v_game;

  return v_game;
end;
$$;

revoke all on function public.admin_quarantine_game(bigint, integer, integer) from public;
revoke all on function public.admin_quarantine_game(bigint, integer, integer) from anon;
grant execute on function public.admin_quarantine_game(bigint, integer, integer) to authenticated;


-- Atomically finalize a reviewed batch of results. Any invalid item aborts the
-- entire batch so the admin never ends up with a partially saved scoreboard.
create or replace function public.admin_finalize_games_bulk(
  p_season integer,
  p_week integer,
  p_results jsonb
)
returns setof public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_item jsonb;
  v_game public.games%rowtype;
  v_game_id bigint;
  v_away_score integer;
  v_home_score integer;
  v_count integer;
  v_distinct_count integer;
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

  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    raise exception 'Results must be a JSON array';
  end if;

  v_count := jsonb_array_length(p_results);
  if v_count < 1 or v_count > 200 then
    raise exception 'A bulk result batch must contain between 1 and 200 games';
  end if;

  select count(*), count(distinct (item->>'game_id')::bigint)
  into v_count, v_distinct_count
  from jsonb_array_elements(p_results) as items(item);

  if v_count <> v_distinct_count then
    raise exception 'The batch contains a duplicate game';
  end if;

  for v_item in
    select item
    from jsonb_array_elements(p_results) as items(item)
    order by (item->>'game_id')::bigint
  loop
    v_game_id := (v_item->>'game_id')::bigint;
    v_away_score := (v_item->>'away_score')::integer;
    v_home_score := (v_item->>'home_score')::integer;

    if v_away_score < 0 or v_home_score < 0 then
      raise exception 'Scores must be whole numbers of 0 or greater';
    end if;

    if v_away_score = v_home_score then
      raise exception 'Tied scores cannot be finalized';
    end if;

    select * into v_game
    from public.games
    where id = v_game_id
      and season = p_season
      and week = p_week
      and coalesce(sync_status, 'scheduled') = 'scheduled'
    for update;

    if not found then
      raise exception 'Game % is unavailable for the requested season and week', v_game_id;
    end if;

    if v_game.is_final then
      raise exception 'Game % is already final', v_game_id;
    end if;

    update public.games
    set away_score = v_away_score,
        home_score = v_home_score,
        is_final = true
    where id = v_game_id
      and season = p_season
      and week = p_week
    returning * into v_game;

    return next v_game;
  end loop;

  return;
end;
$$;

revoke all on function public.admin_finalize_games_bulk(integer, integer, jsonb) from public;
revoke all on function public.admin_finalize_games_bulk(integer, integer, jsonb) from anon;
grant execute on function public.admin_finalize_games_bulk(integer, integer, jsonb) to authenticated;
