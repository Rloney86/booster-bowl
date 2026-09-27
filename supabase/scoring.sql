-- Booster Bowl scoring foundation
-- Run this once in the Supabase SQL editor before merging the feature.

alter table public.games
  add column if not exists away_score integer,
  add column if not exists home_score integer,
  add column if not exists winner text,
  add column if not exists is_final boolean not null default false;

-- Keep winner consistent with a final score. Ties remain NULL so they can be
-- handled explicitly later if Booster Bowl introduces a tie rule.
create or replace function public.set_game_winner()
returns trigger
language plpgsql
as $$
begin
  if new.is_final and new.away_score is not null and new.home_score is not null then
    if new.away_score > new.home_score then
      new.winner := new.away_team;
    elsif new.home_score > new.away_score then
      new.winner := new.home_team;
    else
      new.winner := null;
    end if;
  else
    new.winner := null;
  end if;
  return new;
end;
$$;

drop trigger if exists games_set_winner on public.games;
create trigger games_set_winner
before insert or update of away_score, home_score, is_final, away_team, home_team
on public.games
for each row execute function public.set_game_winner();

-- Existing authenticated users only need SELECT access to see results.
-- Existing games SELECT policies remain in place; no RLS is disabled here.
