-- Private observations reference the original, server-created forecast.
alter table public.strategy_profiles
  add column if not exists settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(settings) = 'object');

create table public.strategy_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fixture_key text not null,
  evaluation_id uuid not null references public.model_evaluations(id),
  selected_at timestamptz not null default now(),
  unique(user_id, fixture_key)
);
create index strategy_journal_user_selected_idx on public.strategy_journal(user_id, selected_at desc);
create index strategy_journal_evaluation_idx on public.strategy_journal(evaluation_id);
alter table public.strategy_journal enable row level security;
revoke all on public.strategy_journal from public, anon, authenticated;
grant select on public.strategy_journal to authenticated;
grant select, insert on public.strategy_journal to service_role;
create policy strategy_journal_read_own on public.strategy_journal for select to authenticated
  using ((select auth.uid()) = user_id);

-- Locks the profile during admission, so concurrent requests cannot exceed the
-- configured weekly observation ceiling. No browser role may insert snapshots.
create function public.validate_strategy_journal() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  prediction public.model_evaluations%rowtype;
  profile public.strategy_profiles%rowtype;
  ceiling_count integer;
  used_count integer;
begin
  select * into profile from public.strategy_profiles where user_id=new.user_id for update;
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  select * into prediction from public.model_evaluations where id=new.evaluation_id;
  if not found or prediction.fixture_key<>new.fixture_key or prediction.fixture_date is null
    or prediction.fixture_date<=now() or prediction.created_at>=prediction.fixture_date
    or prediction.is_correct is not null or prediction.model_version is null then
    raise exception 'FORECAST_UNAVAILABLE';
  end if;
  ceiling_count := least(6,greatest(1,coalesce((profile.settings->>'weeklyLimit')::integer,4)));
  select count(*) into used_count from public.strategy_journal where user_id=new.user_id
    and selected_at >= (date_trunc('week',now() at time zone 'UTC') at time zone 'UTC');
  if used_count>=ceiling_count and not exists(select 1 from public.strategy_journal where user_id=new.user_id and fixture_key=new.fixture_key) then
    raise exception 'WEEKLY_LIMIT';
  end if;
  new.selected_at:=now();
  return new;
end;
$$;
revoke all on function public.validate_strategy_journal() from public, anon, authenticated;
grant execute on function public.validate_strategy_journal() to service_role;
create trigger strategy_journal_valid_insert before insert on public.strategy_journal
  for each row execute function public.validate_strategy_journal();
notify pgrst, 'reload schema';
