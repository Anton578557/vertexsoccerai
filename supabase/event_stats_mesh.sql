-- Vertex Soccer AI event-stat data mesh
-- Applied to production Supabase as migration: vertex_event_stats_mesh

create table if not exists public.match_event_stats (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_match_id text not null,
  fixture_date timestamptz,
  competition text,
  home_team text not null,
  away_team text not null,
  corners_home numeric,
  corners_away numeric,
  yellow_cards_home numeric,
  yellow_cards_away numeric,
  red_cards_home numeric,
  red_cards_away numeric,
  shots_home numeric,
  shots_away numeric,
  shots_on_target_home numeric,
  shots_on_target_away numeric,
  offsides_home numeric,
  offsides_away numeric,
  fouls_home numeric,
  fouls_away numeric,
  penalties_home numeric,
  penalties_away numeric,
  xg_home numeric,
  xg_away numeric,
  possession_home numeric,
  possession_away numeric,
  raw_payload jsonb not null default '{}'::jsonb,
  collected_at timestamptz not null default now(),
  unique (provider, provider_match_id)
);

create table if not exists public.source_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null,
  rows_seen integer not null default 0,
  rows_written integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.match_event_stats enable row level security;
alter table public.source_ingestion_runs enable row level security;

create index if not exists match_event_stats_fixture_date_idx on public.match_event_stats(fixture_date desc);
create index if not exists match_event_stats_teams_idx on public.match_event_stats(home_team, away_team, fixture_date desc);
create index if not exists match_event_stats_provider_idx on public.match_event_stats(provider, fixture_date desc);
create index if not exists source_ingestion_runs_source_idx on public.source_ingestion_runs(source, started_at desc);
