-- Secure score finalization for Booster Bowl.
-- Run this in the Supabase SQL editor before using pages/admin.js.
--
-- IMPORTANT: replace the placeholder email below with the account(s) that
-- should be allowed to finalize scores before applying this migration.

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
set search_path = public, auth
as $$
declare
  v_email text;
  v_game public.games%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select lower(email)
    into v_email
    from auth.users
   where id = auth.uid();

  -- Fail closed until the authorized admin email is deliberately configured.
  if v_email is null or v_email not in ('REPLACE_WITH_ADMIN_EMAIL') then
    raise exception 'Not authorized to finalize Booster Bowl scores';
  end if;

  if p_away_score is null or p_home_score is null
     or p_away_score < 0 or p_home_score < 0 then
    raise exception 'Scores must be whole numbers of 0 or greater';
  end if;

  if p_away_score = p_home_score then
    raise exception 'A final football game must have a winner';
  end if;

  -- Match all three identifiers so a stale UI cannot update a game from a
  -- different week or season. The games_set_winner trigger calculates winner.
  update public.games
     set away_score = p_away_score,
         home_score = p_home_score,
         is_final = true
   where id = p_game_id
     and season = p_season
     and week = p_week
     and is_final = false
  returning * into v_game;

  if not found then
    raise exception 'Game not found for the requested season/week, or it is already final';
  end if;

  if v_game.winner is null then
    raise exception 'Winner was not calculated; finalization aborted';
  end if;

  return v_game;
end;
$$;

revoke all on function public.admin_finalize_game(bigint, integer, integer, integer, integer) from public;
revoke all on function public.admin_finalize_game(bigint, integer, integer, integer, integer) from anon;
grant execute on function public.admin_finalize_game(bigint, integer, integer, integer, integer) to authenticated;
