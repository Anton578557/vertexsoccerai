-- Completion is a product preference, not legal consent.
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;

-- Keep all existing reviews. Stop instead of deleting any legacy excess.
lock table public.reviews in share row exclusive mode;
do $$
begin
  if exists (select 1 from public.reviews group by user_id having count(*) > 2) then
    raise exception 'Existing review counts exceed two; manual reconciliation required';
  end if;
end;
$$;

alter table public.reviews add column review_slot smallint;
with slots as (
  select id,row_number() over (partition by user_id order by created_at nulls last,id) as slot
  from public.reviews
)
update public.reviews r set review_slot=s.slot from slots s where r.id=s.id;

alter table public.reviews alter column review_slot set not null;
alter table public.reviews add constraint reviews_slot_range check (review_slot in (1,2));
alter table public.reviews add constraint reviews_user_slot_key unique (user_id,review_slot);

create function public.enforce_review_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serialize submissions for one account. The unique/range constraints remain
  -- an independent guarantee even when requests overlap or supply their own slot.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,7241));
  select s.slot into new.review_slot
  from pg_catalog.generate_series(1,2) as s(slot)
  where not exists (select 1 from public.reviews r where r.user_id=new.user_id and r.review_slot=s.slot)
  order by s.slot limit 1;
  if new.review_slot is null then
    raise exception using errcode='P0001',message='REVIEW_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_review_limit() from public,anon,authenticated;
create trigger reviews_limit_before_insert
before insert on public.reviews
for each row execute function public.enforce_review_limit();
