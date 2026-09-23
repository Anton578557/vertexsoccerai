-- Additive rollout: preserve every existing forecast and result.
alter table public.model_evaluations
  add column if not exists model_version text,
  add column if not exists forecast jsonb,
  add column if not exists checked_at timestamptz,
  add column if not exists evaluation_status text not null default 'pending',
  add column if not exists evaluation_source text;
create index if not exists model_evaluations_pending_idx
  on public.model_evaluations (checked_at asc nulls first, fixture_date)
  where actual_value is null and evaluation_status = 'pending';
notify pgrst, 'reload schema';
