-- Run as the database owner. All fixtures and assertions roll back.
begin;
select set_config('test.strategy_owner',gen_random_uuid()::text,true);
select set_config('test.strategy_other',gen_random_uuid()::text,true);
select set_config('test.strategy_forecast',gen_random_uuid()::text,true);
select set_config('test.strategy_second',gen_random_uuid()::text,true);
select set_config('test.strategy_late',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role) values
 (current_setting('test.strategy_owner')::uuid,current_setting('test.strategy_owner')||'@example.invalid','authenticated','authenticated'),
 (current_setting('test.strategy_other')::uuid,current_setting('test.strategy_other')||'@example.invalid','authenticated','authenticated');
insert into public.strategy_profiles(user_id,settings) values
 (current_setting('test.strategy_owner')::uuid,'{"weeklyLimit":1}'),
 (current_setting('test.strategy_other')::uuid,'{"weeklyLimit":1}');
insert into public.model_evaluations(id,fixture_key,fixture_date,market,model_version) values
 (current_setting('test.strategy_forecast')::uuid,current_setting('test.strategy_forecast'),now()+interval '1 day','1X2','Vertex Model 2.3'),
 (current_setting('test.strategy_second')::uuid,current_setting('test.strategy_second'),now()+interval '2 days','1X2','Vertex Model 2.3'),
 (current_setting('test.strategy_late')::uuid,current_setting('test.strategy_late'),now()-interval '1 hour','1X2','Vertex Model 2.3');
set local role service_role;
insert into public.strategy_journal(user_id,fixture_key,evaluation_id,selected_at) values
 (current_setting('test.strategy_owner')::uuid,current_setting('test.strategy_forecast'),current_setting('test.strategy_forecast')::uuid,now()-interval '1 month');
do $$begin
 if not exists(select 1 from public.strategy_journal where user_id=current_setting('test.strategy_owner')::uuid and selected_at=now()) then raise exception 'Server timestamp failed'; end if;
 begin
   insert into public.strategy_journal(user_id,fixture_key,evaluation_id) values(current_setting('test.strategy_owner')::uuid,current_setting('test.strategy_second'),current_setting('test.strategy_second')::uuid);
   raise exception 'Weekly limit failed';
 exception when raise_exception then if sqlerrm<>'WEEKLY_LIMIT' then raise; end if; end;
 begin
   insert into public.strategy_journal(user_id,fixture_key,evaluation_id) values(current_setting('test.strategy_other')::uuid,'wrong-fixture',current_setting('test.strategy_forecast')::uuid);
   raise exception 'Fixture binding failed';
 exception when raise_exception then if sqlerrm<>'FORECAST_UNAVAILABLE' then raise; end if; end;
 begin
   insert into public.strategy_journal(user_id,fixture_key,evaluation_id) values(current_setting('test.strategy_other')::uuid,current_setting('test.strategy_late'),current_setting('test.strategy_late')::uuid);
   raise exception 'Late forecast accepted';
 exception when raise_exception then if sqlerrm<>'FORECAST_UNAVAILABLE' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.strategy_owner'),true);
set local role authenticated;
do $$begin
 if (select count(*) from public.strategy_journal where user_id=current_setting('test.strategy_owner')::uuid)<>1 then raise exception 'Owner cannot read journal'; end if;
 if (select count(*) from public.strategy_journal j join public.model_evaluations e on e.id=j.evaluation_id)<>1 then raise exception 'Forecast join denied'; end if;
 begin
   insert into public.strategy_journal(user_id,fixture_key,evaluation_id) values(current_setting('test.strategy_owner')::uuid,current_setting('test.strategy_second'),current_setting('test.strategy_second')::uuid);
   raise exception 'Browser insertion accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.strategy_other'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.strategy_journal where user_id=current_setting('test.strategy_owner')::uuid) then raise exception 'Cross-account leak'; end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform 1 from public.strategy_journal; raise exception 'Anonymous access accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Strategy journal: all isolation, timestamp, limit and forecast checks passed; fixtures rolled back' as result;
