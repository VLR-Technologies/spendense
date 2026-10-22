-- Customer configuration belongs to auth.users, not to financial budget profiles.
-- No detailed income data is stored in Auth metadata. Monthly plans remain authoritative.
create table public.customer_financial_preferences (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  configuration jsonb not null,
  completed_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  last_request uuid not null,
  check (jsonb_typeof(configuration) = 'object'),
  check (configuration->>'category' in ('salaried','freelancer','business','other')),
  check (configuration->>'frequency' in ('monthly','weekly','daily')),
  check (configuration->>'pattern' in ('regular','variable','seasonal')),
  check ((configuration->>'rateMinor')::numeric between 0 and 100000000000 and (configuration->>'rateMinor')::numeric = trunc((configuration->>'rateMinor')::numeric)),
  check (configuration ?& array['category','frequency','pattern','rateMinor','workDays']),
  check (jsonb_typeof(configuration->'workDays')='array'),
  check (jsonb_typeof(configuration->'category')='string' and jsonb_typeof(configuration->'frequency')='string' and jsonb_typeof(configuration->'pattern')='string' and jsonb_typeof(configuration->'rateMinor')='number'),
  check ((not configuration ? 'organization' or jsonb_typeof(configuration->'organization')='string') and (not configuration ? 'occupation' or jsonb_typeof(configuration->'occupation')='string') and (not configuration ? 'notes' or jsonb_typeof(configuration->'notes')='string')),
  check (configuration->>'category'<>'business' or configuration->>'frequency'='monthly'),
  check (length(coalesce(configuration->>'organization',''))<=120 and length(coalesce(configuration->>'occupation',''))<=120 and length(coalesce(configuration->>'notes',''))<=500),
  check (configuration - array['category','frequency','pattern','rateMinor','workDays','organization','occupation','revenueMinor','costsMinor','notes'] = '{}'::jsonb)
);
alter table public.customer_financial_preferences enable row level security;
alter table public.customer_financial_preferences force row level security;
revoke all on public.customer_financial_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.customer_financial_preferences to authenticated;
create policy customer_select on public.customer_financial_preferences for select to authenticated using ((select auth.uid())=owner_id);
create policy customer_insert on public.customer_financial_preferences for insert to authenticated with check ((select auth.uid())=owner_id);
create policy customer_update on public.customer_financial_preferences for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy customer_delete on public.customer_financial_preferences for delete to authenticated using ((select auth.uid())=owner_id);

create function public.spendense_validate_customer() returns trigger
language plpgsql security invoker set search_path='' as $$
declare d jsonb; n numeric;
begin
  if TG_OP='UPDATE' and new.owner_id<>old.owner_id then raise exception 'Immutable owner' using errcode='42501'; end if;
  if jsonb_typeof(new.configuration->'workDays')<>'array' then raise exception 'Invalid work schedule' using errcode='23514'; end if;
  for d in select value from jsonb_array_elements(new.configuration->'workDays') loop
    if jsonb_typeof(d)<>'number' or d::text !~ '^[0-6]$' then raise exception 'Invalid paid weekday' using errcode='23514'; end if;
  end loop;
  if (select count(*)<>count(distinct value) from jsonb_array_elements(new.configuration->'workDays')) or jsonb_array_length(new.configuration->'workDays')>7 or (new.configuration->>'frequency'='daily' and jsonb_array_length(new.configuration->'workDays')=0) then raise exception 'Select unique paid weekdays' using errcode='23514'; end if;
  foreach d in array array[new.configuration->'revenueMinor',new.configuration->'costsMinor'] loop
    if d is not null and d<>'null'::jsonb then
      n:=d::text::numeric;
      if jsonb_typeof(d)<>'number' or n<0 or n>100000000000 or n<>trunc(n) then raise exception 'Invalid business amount' using errcode='23514'; end if;
    end if;
  end loop;
  return new;
end $$;
create trigger customer_validation before insert or update on public.customer_financial_preferences for each row execute function public.spendense_validate_customer();

-- Idempotent completion/edit transaction. It never changes income without an explicit amount.
-- A current-month compare-and-set protects edits made in another tab during review.
create function public.spendense_save_customer(
  p_configuration jsonb, p_request uuid, p_expected_revision bigint,
  p_profile text default null, p_month public.daywise_month default null,
  p_amount public.daywise_minor default null, p_scope text default 'month',
  p_expected_income public.daywise_minor default null, p_expected_override boolean default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.customer_financial_preferences; plan public.monthly_plans; result public.customer_financial_preferences;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_request is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid request' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,823));
  select * into existing from public.customer_financial_preferences where owner_id=auth.uid() for update;
  if existing.last_request=p_request then return to_jsonb(existing)-'last_request'; end if;
  if coalesce(existing.revision,0)<>p_expected_revision then raise exception 'Customer details changed; reload' using errcode='40001'; end if;
  if p_profile is not null then
    perform public.daywise_lock(p_profile);
    if p_month is null then raise exception 'Month required' using errcode='22023'; end if;
    if p_amount is not null then
      if p_scope not in ('month','default') or p_month < to_char(current_date,'YYYY-MM') then raise exception 'Choose the current or a future month' using errcode='22023'; end if;
      perform public.daywise_ensure_month(p_profile,p_month);
      select * into plan from public.monthly_plans where "profileId"=p_profile and "yearMonth"=p_month;
      if p_expected_income is null or p_expected_override is null or plan."monthlyIncomeMinor"<>p_expected_income or plan."incomeOverride"<>p_expected_override then raise exception 'Income changed; review again' using errcode='40001'; end if;
      perform public.daywise_income(p_profile,p_month,p_amount,p_scope);
    end if;
    update public.profiles set "onboardingComplete"=true where id=p_profile and owner_id=auth.uid();
  elsif p_amount is not null then raise exception 'Budget required' using errcode='22023'; end if;
  insert into public.customer_financial_preferences(owner_id,configuration,revision,last_request)
    values(auth.uid(),p_configuration,1,p_request)
    on conflict(owner_id) do update set configuration=excluded.configuration,revision=customer_financial_preferences.revision+1,last_request=excluded.last_request
    returning * into result;
  return to_jsonb(result)-'last_request';
end $$;
revoke all on function public.spendense_validate_customer() from public,anon,authenticated;
revoke all on function public.spendense_save_customer(jsonb,uuid,bigint,text,public.daywise_month,public.daywise_minor,text,public.daywise_minor,boolean) from public,anon,authenticated;
grant execute on function public.spendense_save_customer(jsonb,uuid,bigint,text,public.daywise_month,public.daywise_minor,text,public.daywise_minor,boolean) to authenticated;
