-- Booster Bowl aggregate team leaderboards
-- Run this file in the Supabase SQL Editor after supabase/scoring.sql.
-- Both functions return team-level statistics only; they do not expose player
-- names, emails, user IDs, or individual picks.

create or replace function public.get_booster_leaderboard()
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
    count(distinct p.id)::bigint as supporters,
    count(pk.id)::bigint as total_picks,
    count(pk.id) filter (where g.is_final = true)::bigint as completed_picks,
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
  left join public.games g on g.id = pk.game_id
  where nullif(trim(p.booster_name), '') is not null
  group by p.booster_name, p.school_name
  order by accuracy_percent desc, correct_picks desc, supporters desc, p.booster_name;
$$;

create or replace function public.get_booster_leaderboard_week(p_season integer, p_week integer)
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
    count(pk.id) filter (where g.is_final = true)::bigint as completed_picks,
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
   and g.week = p_week
  where nullif(trim(p.booster_name), '') is not null
  group by p.booster_name, p.school_name
  order by accuracy_percent desc, correct_picks desc, supporters desc, p.booster_name;
$$;

revoke all on function public.get_booster_leaderboard() from public;
grant execute on function public.get_booster_leaderboard() to authenticated;

revoke all on function public.get_booster_leaderboard_week(integer, integer) from public;
grant execute on function public.get_booster_leaderboard_week(integer, integer) to authenticated;


-- Individual player standings. This intentionally exposes only public-facing
-- display names and scoring totals. Emails, auth user IDs, and individual pick
-- selections remain private.
create or replace function public.get_player_leaderboard(
  p_season integer,
  p_week integer default null
)
returns table (
  ranking bigint,
  display_name text,
  booster_name text,
  completed_picks bigint,
  correct_picks bigint,
  accuracy_percent integer,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select
      p.id,
      coalesce(nullif(trim(p.display_name), ''), 'Player') as display_name,
      coalesce(nullif(trim(p.booster_name), ''), 'Independent') as booster_name,
      (p.user_id = auth.uid()) as is_current_user,
      count(pk.id) filter (
        where g.is_final = true
          and g.winner is not null
      )::bigint as completed_picks,
      count(pk.id) filter (
        where g.is_final = true
          and g.winner is not null
          and pk.selected_team = g.winner
      )::bigint as correct_picks
    from public.players p
    join public.picks pk on pk.player_id = p.id
    join public.games g on g.id = pk.game_id
    where g.season = p_season
      and (p_week is null or g.week = p_week)
    group by p.id, p.display_name, p.booster_name, p.user_id
  ),
  calculated as (
    select
      display_name,
      booster_name,
      completed_picks,
      correct_picks,
      case
        when completed_picks = 0 then 0
        else round(100.0 * correct_picks / completed_picks)::integer
      end as accuracy_percent,
      is_current_user
    from scored
    where completed_picks > 0
  )
  select
    dense_rank() over (
      order by correct_picks desc, accuracy_percent desc, completed_picks desc
    )::bigint as ranking,
    display_name,
    booster_name,
    completed_picks,
    correct_picks,
    accuracy_percent,
    is_current_user
  from calculated
  order by ranking, display_name;
$$;

revoke all on function public.get_player_leaderboard(integer, integer) from public;
grant execute on function public.get_player_leaderboard(integer, integer) to authenticated;
