-- Booster Bowl 2026 Week 1 pick-board metadata bootstrap
-- Run once in the Supabase SQL Editor after supabase/pick_boards.sql.
-- This safely enriches the current Week 1 catalog without changing game IDs,
-- picks, results, or scoring.

-- Mark the existing Week 1 statewide slate as featured so the Featured board
-- appears immediately. This can be narrowed later when a curated featured
-- slate is introduced.
update public.games
set is_featured = true
where season = 2026
  and week = 1
  and coalesce(sport, 'football') = 'football';

-- Populate district metadata where the current catalog already contains known
-- district matchups. Only NULL/blank values are filled so manually curated
-- production metadata always wins.
update public.games
set district = case
  when (away_team = 'Varina' and home_team = 'Henrico') or (away_team = 'Henrico' and home_team = 'Varina') then 'Capital'
  when (away_team = 'Maury' and home_team = 'Churchland') or (away_team = 'Churchland' and home_team = 'Maury') then 'Eastern'
  when (away_team = 'King''s Fork' and home_team = 'Oscar Smith') or (away_team = 'Oscar Smith' and home_team = 'King''s Fork') then 'Southeastern'
  when (away_team = 'Indian River' and home_team = 'Grassfield') or (away_team = 'Grassfield' and home_team = 'Indian River') then 'Southeastern'
  when (away_team = 'Jefferson Forest' and home_team = 'Liberty Christian') or (away_team = 'Liberty Christian' and home_team = 'Jefferson Forest') then 'Seminole'
  when (away_team = 'Louisa County' and home_team = 'Fluvanna County') or (away_team = 'Fluvanna County' and home_team = 'Louisa County') then 'Jefferson'
  else district
end
where season = 2026
  and week = 1
  and (district is null or btrim(district) = '');

-- Add the Dominion District demo matchups if they are not already in the Week 1
-- catalog. They use real game rows so every board references the same game ID.
-- Existing schemas created earlier in Booster Bowl require winner/is_final, so
-- those columns are supplied explicitly.
insert into public.games
  (season, week, away_team, home_team, winner, is_final, sport, district,
   away_class, away_region, home_class, home_region, is_featured, kickoff_at,
   source_name)
select 2026, 1, 'Cosby', 'Manchester', null, false, 'football', 'Dominion',
       'Class 6', 'Region A', 'Class 6', 'Region A', false, null,
       'Booster Bowl catalog'
where not exists (
  select 1 from public.games
  where season = 2026 and week = 1
    and ((away_team = 'Cosby' and home_team = 'Manchester')
      or (away_team = 'Manchester' and home_team = 'Cosby'))
);

insert into public.games
  (season, week, away_team, home_team, winner, is_final, sport, district,
   away_class, away_region, home_class, home_region, is_featured, kickoff_at,
   source_name)
select 2026, 1, 'Monacan', 'Powhatan', null, false, 'football', 'Dominion',
       'Class 4', 'Region B', 'Class 4', 'Region B', false, null,
       'Booster Bowl catalog'
where not exists (
  select 1 from public.games
  where season = 2026 and week = 1
    and ((away_team = 'Monacan' and home_team = 'Powhatan')
      or (away_team = 'Powhatan' and home_team = 'Monacan'))
);

-- If those games already existed, enrich them instead of duplicating them.
update public.games
set district = 'Dominion',
    away_class = case when away_team in ('Cosby','Manchester') then 'Class 6' else away_class end,
    away_region = case when away_team in ('Cosby','Manchester') then 'Region A' else away_region end,
    home_class = case when home_team in ('Cosby','Manchester') then 'Class 6' else home_class end,
    home_region = case when home_team in ('Cosby','Manchester') then 'Region A' else home_region end
where season = 2026 and week = 1
  and ((away_team in ('Cosby','Manchester') and home_team in ('Cosby','Manchester')));

update public.games
set district = 'Dominion',
    away_class = case when away_team in ('Monacan','Powhatan') then 'Class 4' else away_class end,
    away_region = case when away_team in ('Monacan','Powhatan') then 'Region B' else away_region end,
    home_class = case when home_team in ('Monacan','Powhatan') then 'Class 4' else home_class end,
    home_region = case when home_team in ('Monacan','Powhatan') then 'Region B' else home_region end
where season = 2026 and week = 1
  and ((away_team in ('Monacan','Powhatan') and home_team in ('Monacan','Powhatan')));

-- Verification: after running, this should show populated Featured, District,
-- Region, Classification, and School data feeding get_pick_board_games().
select * from public.get_pick_board_games(2026, 1);
