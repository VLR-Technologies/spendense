begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
insert into auth.users(id,email) values
  ('44444444-4444-4444-8444-444444444444','payment-a@daywise.test'),
  ('55555555-5555-4555-8555-555555555555','payment-b@daywise.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
insert into profiles(id,"displayName") values ('payments','Payment history');
select daywise_commitment('{"id":"bill","profileId":"payments","yearMonth":"2026-10","name":"Bill","category":"Other","amountMinor":12345,"origin":"one-time","paid":false,"notes":""}','month');
select daywise_set_paid('payments','bill',true);
select daywise_set_paid('payments','bill',true);
select ok((select paid from monthly_commitments where id='bill'),'Repeated paid write remains paid');
select is((select "amountMinor"::bigint from monthly_commitments where id='bill'),12345::bigint,'Payment write preserves exact paise');
select daywise_set_paid('payments','bill',false);
select daywise_set_paid('payments','bill',false);
select ok(not (select paid from monthly_commitments where id='bill'),'Repeated unpaid write remains unpaid');
select throws_ok($q$select daywise_set_paid('payments','bill',null)$q$,'22004',null,'Null payment state is rejected');
select throws_ok($q$select daywise_set_paid('payments','missing',true)$q$,'42501',null,'Missing bill is rejected');
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select throws_ok($q$select daywise_set_paid('payments','bill',true)$q$,'42501',null,'Second account cannot change first account payment state');
set local role anon;
select throws_ok($q$select public.daywise_set_paid('payments','bill',true)$q$,'42501',null,'Anonymous payment update is denied');
reset role;
select is((select prosecdef from pg_proc where oid='public.daywise_set_paid(text,text,boolean)'::regprocedure),false,'Payment RPC uses caller permissions');
select * from finish();
rollback;
