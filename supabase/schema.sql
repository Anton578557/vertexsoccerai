-- Vertex Soccer AI 2.0 core schema
-- Production is managed through tracked migrations. This file is the canonical
-- baseline for a fresh project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  fixture_date timestamptz,
  main_scenario text,
  confidence integer check (confidence between 0 and 100),
  data_quality integer check (data_quality between 0 and 100),
  analysis_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  fixture_date timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, home_team, away_team, fixture_date)
);

create table if not exists public.strategy_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bankroll_reference numeric,
  experience text,
  risk_profile text,
  objective text,
  leagues jsonb not null default '[]'::jsonb,
  markets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.model_evaluations (
  id uuid primary key default gen_random_uuid(),
  fixture_key text not null,
  fixture_date timestamptz,
  market text not null,
  predicted_value text,
  predicted_probability numeric,
  actual_value text,
  is_correct boolean,
  data_quality integer,
  model_version text,
  forecast jsonb,
  checked_at timestamptz,
  evaluation_status text not null default 'pending',
  evaluation_source text,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (fixture_key, market)
);

alter table public.profiles enable row level security;
alter table public.analysis_history enable row level security;
alter table public.saved_matches enable row level security;
alter table public.strategy_profiles enable row level security;
alter table public.model_evaluations enable row level security;

-- Recreate user-owned policies with auth.uid() evaluated once per statement.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  using ((select auth.uid()) = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists analysis_history_own on public.analysis_history;
create policy analysis_history_own on public.analysis_history for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists saved_matches_own on public.saved_matches;
create policy saved_matches_own on public.saved_matches for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists strategy_profiles_own on public.strategy_profiles;
create policy strategy_profiles_own on public.strategy_profiles for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists model_evaluations_public_read on public.model_evaluations;
create policy model_evaluations_public_read on public.model_evaluations for select using (true);

create index if not exists analysis_history_user_created_idx on public.analysis_history(user_id, created_at desc);
create index if not exists saved_matches_user_created_idx on public.saved_matches(user_id, created_at desc);
create index if not exists model_evaluations_date_idx on public.model_evaluations(fixture_date desc);
create index if not exists model_evaluations_pending_idx
  on public.model_evaluations (checked_at asc nulls first, fixture_date asc)
  where actual_value is null and evaluation_status = 'pending';
