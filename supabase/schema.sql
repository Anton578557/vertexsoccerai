-- Vertex Soccer AI 2.0
-- Run once in Supabase SQL Editor after reviewing the policies.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
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

-- Public model performance is deliberately separated from user history.
-- A future server-side result checker will populate this table after matches finish.
create table if not exists public.model_evaluations (
  id uuid primary key default gen_random_uuid(),
  fixture_key text not null unique,
  fixture_date timestamptz,
  market text not null,
  predicted_value text,
  predicted_probability numeric,
  actual_value text,
  is_correct boolean,
  data_quality integer,
  evaluated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.analysis_history enable row level security;
alter table public.saved_matches enable row level security;
alter table public.strategy_profiles enable row level security;
alter table public.model_evaluations enable row level security;

-- Idempotent user-owned policies.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own') then
    create policy profiles_select_own on public.profiles for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_own') then
    create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own') then
    create policy profiles_update_own on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='analysis_history' and policyname='analysis_history_own') then
    create policy analysis_history_own on public.analysis_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_matches' and policyname='saved_matches_own') then
    create policy saved_matches_own on public.saved_matches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='strategy_profiles' and policyname='strategy_profiles_own') then
    create policy strategy_profiles_own on public.strategy_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='model_evaluations' and policyname='model_evaluations_public_read') then
    create policy model_evaluations_public_read on public.model_evaluations for select using (true);
  end if;
end $$;

create index if not exists analysis_history_user_created_idx on public.analysis_history(user_id, created_at desc);
create index if not exists saved_matches_user_created_idx on public.saved_matches(user_id, created_at desc);
create index if not exists model_evaluations_date_idx on public.model_evaluations(fixture_date desc);
