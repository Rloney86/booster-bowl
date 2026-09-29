-- Booster Bowl Week 2 / multi-week foundation
-- Run in Supabase SQL Editor BEFORE deploying feature/week-2-multiweek.

create or replace function public.submit_weekly_picks(
  p_player_name text,
  p_booster_name text,
  p_school_name text,
  p_season integer,
  p_week integer,
  p_picks jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id public.players.id%type;
  v_count integer;
  v_distinct_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in before submitting picks' using errcode = '42501';
  end if;

  if nullif(trim(p_player_name), '') is null then
    raise exception 'Player name is required';
  end if;

  if jsonb_typeof(p_picks) <> 'array' then
    raise exception 'Picks payload must be an array';
  end if;

  select count(*), count(distinct (item->>'game_id'))
  into v_count, v_distinct_count
  from jsonb_array_elements(p_picks) item;

  if v_count = 0 then
    raise exception 'At least one pick is required';
  end if;

  if v_count <> v_distinct_count then
    raise exception 'Duplicate games are not allowed in one submission';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_picks) item
    left join public.games g
      on g.id = (item->>'game_id')::bigint
     and g.season = p_season
     and g.week = p_week
    where g.id is null
       or (item->>'selected_team') is null
       or (item->>'selected_team') not in (g.away_team, g.home_team)
  ) then
    raise exception 'One or more picks do not match the requested week';
  end if;

  insert into public.players (
    user_id,
    display_name,
    email,
    booster_name,
    school_name
  )
  values (
    auth.uid(),
    trim(p_player_name),
    coalesce(auth.jwt() ->> 'email', ''),
    coalesce(p_booster_name, ''),
    coalesce(p_school_name, '')
  )
  on conflict (user_id)
  do update set
    display_name = excluded.display_name,
    email = excluded.email,
    booster_name = excluded.booster_name,
    school_name = excluded.school_name
  returning id into v_player_id;

  -- Replace only this submitted board's games. If anything below fails,
  -- PostgreSQL rolls the whole function back, preventing partial submissions.
  delete from public.picks
  where player_id = v_player_id
    and game_id in (
      select (item->>'game_id')::bigint
      from jsonb_array_elements(p_picks) item
    );

  insert into public.picks (player_id, game_id, selected_team)
  select
    v_player_id,
    (item->>'game_id')::bigint,
    item->>'selected_team'
  from jsonb_array_elements(p_picks) item;

  return v_count;
end;
$$;

revoke all on function public.submit_weekly_picks(text, text, text, integer, integer, jsonb) from public;
grant execute on function public.submit_weekly_picks(text, text, text, integer, integer, jsonb) to authenticated;


create or replace function public.admin_reopen_game(
  p_game_id bigint,
  p_season integer,
  p_week integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'mr.rayloney@gmail.com' then
    raise exception 'Not authorized to update game results'
      using errcode = '42501';
  end if;

  update public.games
  set
    away_score = null,
    home_score = null,
    winner = null,
    is_final = false
  where id = p_game_id
    and season = p_season
    and week = p_week;

  if not found then
    raise exception 'Game not found for the requested season and week';
  end if;

  return true;
end;
$$;

revoke all on function public.admin_reopen_game(bigint, integer, integer) from public;
grant execute on function public.admin_reopen_game(bigint, integer, integer) to authenticated;


create or replace function public.get_booster_leaderboard_season(p_season integer)
returns table (
  booster_name text,
  school_name text,
  supporters bigint,
  total_picks bigint,
  completed_picks bigint,
  correct_picks bigint,
  accuracy_percent integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.booster_name,
    p.school_name,
    count(distinct p.id) filter (where g.id is not null)::bigint as supporters,
    count(pk.id) filter (where g.id is not null)::bigint as total_picks,
    count(pk.id) filter (where g.is_final = true and g.winner is not null)::bigint as completed_picks,
    count(pk.id) filter (
      where g.is_final = true
        and g.winner is not null
        and pk.selected_team = g.winner
    )::bigint as correct_picks,
    case
      when count(pk.id) filter (where g.is_final = true and g.winner is not null) = 0 then 0
      else round(
        100.0
        * count(pk.id) filter (
            where g.is_final = true
              and g.winner is not null
              and pk.selected_team = g.winner
          )
        / count(pk.id) filter (
            where g.is_final = true
              and g.winner is not null
          )
      )::integer
    end as accuracy_percent
  from public.players p
  left join public.picks pk on pk.player_id = p.id
  left join public.games g
    on g.id = pk.game_id
   and g.season = p_season
  where nullif(trim(p.booster_name), '') is not null
  group by p.booster_name, p.school_name
  order by accuracy_percent desc, correct_picks desc, supporters desc, p.booster_name;
$$;

revoke all on function public.get_booster_leaderboard_season(integer) from public;
grant execute on function public.get_booster_leaderboard_season(integer) to authenticated;
