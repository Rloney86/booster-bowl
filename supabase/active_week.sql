-- Booster Bowl active season/week configuration
-- Development migration. Run after pick_boards.sql.

create table if not exists public.app_config (
  config_key text primary key,
  config_value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

insert into public.app_config (config_key, config_value)
values ('football_active_week', jsonb_build_object(
  'season', 2026,
  'week', 1,
  'picks_open', true,
  'deadline_text', 'Lock picks before first kickoff this week.'
))
on conflict (config_key) do nothing;

create or replace function public.get_active_pick_week()
returns table (
  season integer,
  week integer,
  picks_open boolean,
  deadline_text text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((config_value->>'season')::integer, 2026),
    coalesce((config_value->>'week')::integer, 1),
    coalesce((config_value->>'picks_open')::boolean, true),
    coalesce(config_value->>'deadline_text', 'Lock picks before first kickoff this week.')
  from public.app_config
  where config_key = 'football_active_week';
$$;

revoke all on function public.get_active_pick_week() from public;
grant execute on function public.get_active_pick_week() to anon, authenticated;

-- Admin helper: advance/change the live football board without redeploying Next.js.
create or replace function public.set_active_pick_week(
  p_season integer,
  p_week integer,
  p_picks_open boolean default true,
  p_deadline_text text default 'Lock picks before first kickoff this week.'
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.app_config (config_key, config_value, updated_at)
  values (
    'football_active_week',
    jsonb_build_object(
      'season', p_season,
      'week', p_week,
      'picks_open', p_picks_open,
      'deadline_text', p_deadline_text
    ),
    now()
  )
  on conflict (config_key) do update
  set config_value = excluded.config_value,
      updated_at = excluded.updated_at;
$$;

revoke all on function public.set_active_pick_week(integer, integer, boolean, text) from public;

comment on table public.app_config is
  'Runtime Booster Bowl configuration. Active week can change without a code deployment.';
