-- All RPCs run as the caller; RLS is never bypassed. Serialise app operations per workspace.
create function public.daywise_lock(p_id text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = p_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Workspace unavailable or access denied' using errcode = '42501'; end if;
end $$;

create function public.daywise_export(p_id text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  perform public.daywise_lock(p_id);
  select jsonb_build_object('format','daywise','version',1,'exportedAt',now(),
    'profile', (select to_jsonb(p) - 'owner_id' from public.profiles p where id = p_id),
    'incomes', (select coalesce(jsonb_agg(to_jsonb(t)-'owner_id' order by id),'[]') from public.income_revisions t where "profileId" = p_id),
    'recurring', (select coalesce(jsonb_agg(to_jsonb(t)-'owner_id' order by id),'[]') from public.recurring_revisions t where "profileId" = p_id),
    'plans', (select coalesce(jsonb_agg(to_jsonb(t)-'owner_id' order by id),'[]') from public.monthly_plans t where "profileId" = p_id),
    'commitments', (select coalesce(jsonb_agg(to_jsonb(t)-'owner_id' order by id),'[]') from public.monthly_commitments t where "profileId" = p_id),
    'expenses', (select coalesce(jsonb_agg(to_jsonb(t)-'owner_id' order by id),'[]') from public.daily_expenses t where "profileId" = p_id),
    'categories', (select coalesce(jsonb_agg(to_jsonb(t)-'owner_id' order by id),'[]') from public.categories t where "profileId" = p_id)) into result;
  return result;
end $$;

create function public.daywise_ensure_month(p_id text, p_month public.daywise_month) returns void
language plpgsql security invoker set search_path = '' as $$
declare new_id text;
begin
  perform public.daywise_lock(p_id);
  insert into public.monthly_plans ("profileId", "yearMonth", "monthlyIncomeMinor")
    values (p_id, p_month, coalesce((select "amountMinor" from public.income_revisions
      where "profileId"=p_id and "effectiveMonth"<=p_month order by "effectiveMonth" desc limit 1),0))
    on conflict ("profileId", "yearMonth") do nothing returning id into new_id;
  if new_id is not null then
    insert into public.monthly_commitments ("profileId","yearMonth","sourceId",name,category,"amountMinor",origin,"paymentDay",notes)
      select p_id,p_month,r."sourceId",r.name,r.category,r."amountMinor",'recurring',r."paymentDay",r.notes
      from (select distinct on ("sourceId") * from public.recurring_revisions
        where "profileId"=p_id and "effectiveMonth"<=p_month order by "sourceId","effectiveMonth" desc) r
      where r.active and r."startMonth"<=p_month and (r."endMonth" is null or r."endMonth">=p_month);
  end if;
end $$;

create function public.daywise_month(p_id text, p_month public.daywise_month) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.daywise_ensure_month(p_id,p_month);
  return public.daywise_export(p_id);
end $$;

create function public.daywise_income(p_id text, p_month public.daywise_month, p_amount public.daywise_minor, p_scope text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_scope not in ('default','month','reset') then raise exception 'Invalid scope'; end if;
  perform public.daywise_ensure_month(p_id,p_month);
  if p_scope='default' then
    insert into public.income_revisions ("profileId","effectiveMonth","amountMinor") values(p_id,p_month,p_amount)
      on conflict ("profileId","effectiveMonth") do update set "amountMinor"=excluded."amountMinor";
    update public.monthly_plans p set "monthlyIncomeMinor"=coalesce((select i."amountMinor" from public.income_revisions i
      where i."profileId"=p_id and i."effectiveMonth"<=p."yearMonth" order by i."effectiveMonth" desc limit 1),0)
      where p."profileId"=p_id and p."yearMonth">=p_month and not p."incomeOverride";
  end if;
  update public.monthly_plans set "incomeOverride"=(p_scope='month'),
    "monthlyIncomeMinor"=case when p_scope='reset' then coalesce((select "amountMinor" from public.income_revisions
      where "profileId"=p_id and "effectiveMonth"<=p_month order by "effectiveMonth" desc limit 1),0) else p_amount end
    where "profileId"=p_id and "yearMonth"=p_month;
end $$;

create function public.daywise_commitment(p_record jsonb, p_scope text, p_options jsonb default '{}') returns void
language plpgsql security invoker set search_path = '' as $$
declare c public.monthly_commitments; r public.recurring_revisions; p public.monthly_plans; effective public.recurring_revisions; old public.monthly_commitments;
begin
  if p_scope not in ('month','future') then raise exception 'Invalid scope'; end if;
  c := jsonb_populate_record(null::public.monthly_commitments,
    jsonb_build_object('monthOverride',false,'excluded',false,'notes','') || p_record || jsonb_build_object('owner_id',auth.uid()));
  perform public.daywise_ensure_month(c."profileId",c."yearMonth");
  if p_scope='future' then
    c."sourceId" := coalesce(c."sourceId",gen_random_uuid()::text);
    c.origin := 'recurring'; c."monthOverride" := false; c.excluded := false;
    insert into public.recurring_sources(id,"profileId") values(c."sourceId",c."profileId") on conflict(id) do nothing;
    r := jsonb_populate_record(null::public.recurring_revisions,
      jsonb_build_object('id',gen_random_uuid()::text,'owner_id',auth.uid(),'profileId',c."profileId",'sourceId',c."sourceId",
        'effectiveMonth',c."yearMonth",'name',c.name,'category',c.category,'amountMinor',c."amountMinor",'currency','INR',
        'frequency','monthly','active',coalesce((p_options->>'active')::boolean,true),
        'startMonth',coalesce(p_options->>'startMonth',c."yearMonth"),'endMonth',p_options->>'endMonth',
        'paymentDay',c."paymentDay",'notes',c.notes));
    insert into public.recurring_revisions select r.* on conflict("profileId","sourceId","effectiveMonth") do update set
      name=excluded.name,category=excluded.category,"amountMinor"=excluded."amountMinor",active=excluded.active,
      "startMonth"=excluded."startMonth","endMonth"=excluded."endMonth","paymentDay"=excluded."paymentDay",notes=excluded.notes;
  else c."monthOverride" := c."sourceId" is not null;
  end if;
  insert into public.monthly_commitments select c.* on conflict(id) do update set
    "sourceId"=excluded."sourceId",name=excluded.name,category=excluded.category,"amountMinor"=excluded."amountMinor",
    origin=excluded.origin,paid=excluded.paid,"monthOverride"=excluded."monthOverride",excluded=excluded.excluded,
    "paymentDay"=excluded."paymentDay",notes=excluded.notes
    where monthly_commitments."profileId"=c."profileId" and monthly_commitments."yearMonth"=c."yearMonth";
  if not found then raise exception 'Commitment identity conflict' using errcode='42501'; end if;
  if p_scope='future' then
    for p in select * from public.monthly_plans where "profileId"=c."profileId" and "yearMonth">c."yearMonth" loop
      effective := null; old := null;
      select * into effective from public.recurring_revisions where "profileId"=c."profileId" and "sourceId"=c."sourceId"
        and "effectiveMonth"<=p."yearMonth" order by "effectiveMonth" desc limit 1;
      select * into old from public.monthly_commitments where "profileId"=c."profileId" and "yearMonth"=p."yearMonth" and "sourceId"=c."sourceId";
      if effective.active and effective."startMonth"<=p."yearMonth" and (effective."endMonth" is null or effective."endMonth">=p."yearMonth") then
        if not coalesce(old."monthOverride",false) then
          insert into public.monthly_commitments(id,"profileId","yearMonth","sourceId",name,category,"amountMinor",origin,paid,"paymentDay",notes)
            values(coalesce(old.id,gen_random_uuid()::text),c."profileId",p."yearMonth",c."sourceId",effective.name,effective.category,
              effective."amountMinor",'recurring',coalesce(old.paid,false),effective."paymentDay",effective.notes)
            on conflict(id) do update set name=excluded.name,category=excluded.category,"amountMinor"=excluded."amountMinor",
              "paymentDay"=excluded."paymentDay",notes=excluded.notes;
        end if;
      elsif old.id is not null then delete from public.monthly_commitments where id=old.id;
      end if;
    end loop;
    if not r.active or r."startMonth">c."yearMonth" or r."endMonth"<c."yearMonth" then
      delete from public.monthly_commitments where id=c.id;
    end if;
  end if;
end $$;

create function public.daywise_remove(p_id text, p_commitment text, p_future boolean) returns void
language plpgsql security invoker set search_path = '' as $$
declare c public.monthly_commitments;
begin
  perform public.daywise_lock(p_id);
  select * into c from public.monthly_commitments where id=p_commitment and "profileId"=p_id;
  if not found then raise exception 'Commitment unavailable' using errcode='42501'; end if;
  if p_future and c."sourceId" is not null then
    perform public.daywise_commitment(to_jsonb(c),'future','{"active":false}');
  elsif c."sourceId" is not null then
    update public.monthly_commitments set excluded=true,"monthOverride"=true where id=c.id;
  else delete from public.monthly_commitments where id=c.id;
  end if;
end $$;

create function public.daywise_paid(p_id text, p_commitment text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.daywise_lock(p_id);
  update public.monthly_commitments set paid=not paid where id=p_commitment and "profileId"=p_id;
  if not found then raise exception 'Commitment unavailable' using errcode='42501'; end if;
end $$;

-- Deterministic manifest includes all record counts, money, and every materialised month.
create function public.daywise_manifest(p_backup jsonb) returns jsonb
language sql immutable security invoker set search_path = '' as $$
select jsonb_build_object(
  'counts',(select jsonb_object_agg(k,jsonb_array_length(p_backup->k)) from unnest(array['incomes','recurring','plans','commitments','expenses','categories']) k),
  'totals',(select jsonb_object_agg(k,coalesce((select sum((v->>case when k='plans' then 'monthlyIncomeMinor' else 'amountMinor' end)::bigint)
    from jsonb_array_elements(p_backup->k) v),0)) from unnest(array['incomes','recurring','plans','commitments','expenses']) k),
  'months',coalesce((select jsonb_object_agg(p->>'yearMonth',jsonb_build_object(
    'income',(p->>'monthlyIncomeMinor')::bigint,
    'fixed',coalesce((select sum((c->>'amountMinor')::bigint) from jsonb_array_elements(p_backup->'commitments') c where c->>'yearMonth'=p->>'yearMonth' and not coalesce((c->>'excluded')::boolean,false)),0),
    'spent',coalesce((select sum((e->>'amountMinor')::bigint) from jsonb_array_elements(p_backup->'expenses') e where left(e->>'date',7)=p->>'yearMonth'),0)))
    from jsonb_array_elements(p_backup->'plans') p),'{}'))
$$;

create function public.daywise_import(p_backup jsonb, p_source text, p_fingerprint text, p_manifest jsonb, p_owner uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare receipt public.local_migrations; workspace text := p_backup->'profile'->>'id'; item jsonb; name text; table_name text; actual jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_owner then raise exception 'Sign in required' using errcode='42501'; end if;
  -- Prevent two interrupted/concurrent attempts creating multiple workspaces.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_source,0));
  select * into receipt from public.local_migrations where owner_id=auth.uid() and source_profile=p_source;
  if found then
    if receipt.fingerprint<>p_fingerprint then raise exception 'This local profile was already imported. Its local copy has since changed; histories were not merged.' using errcode='23505'; end if;
    perform public.daywise_lock(receipt.profile_id);
    return jsonb_build_object('profileId',receipt.profile_id,'manifest',receipt.manifest,'repeated',true);
  end if;
  if p_backup->>'format' is distinct from 'daywise' or p_backup->>'version' is distinct from '1' then raise exception 'Invalid backup'; end if;
  if public.daywise_manifest(p_backup) is distinct from p_manifest then raise exception 'Import manifest mismatch'; end if;
  insert into public.profiles select (jsonb_populate_record(null::public.profiles,p_backup->'profile' || jsonb_build_object('owner_id',auth.uid()))).*;
  for name,table_name in select * from (values ('incomes','income_revisions'),('recurring','recurring_revisions'),('plans','monthly_plans'),
      ('commitments','monthly_commitments'),('expenses','daily_expenses'),('categories','categories')) as tables(n,t) loop
    if jsonb_typeof(p_backup->name) is distinct from 'array' then raise exception 'Invalid backup collection'; end if;
    for item in select value from jsonb_array_elements(p_backup->name) loop
      if item->>'profileId' is distinct from workspace then raise exception 'Mixed workspace import' using errcode='42501'; end if;
      if name='recurring' then
        insert into public.recurring_sources(id,"profileId") values(item->>'sourceId',workspace) on conflict(id) do nothing;
      end if;
      item := jsonb_build_object('monthOverride',false,'excluded',false) || item || jsonb_build_object('owner_id',auth.uid());
      execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).*',table_name,table_name) using item;
    end loop;
  end loop;
  actual := public.daywise_manifest(public.daywise_export(workspace));
  if actual is distinct from p_manifest then raise exception 'Stored import verification failed'; end if;
  insert into public.local_migrations(source_profile,profile_id,fingerprint,manifest) values(p_source,workspace,p_fingerprint,actual);
  return jsonb_build_object('profileId',workspace,'manifest',actual,'repeated',false);
end $$;

-- Explicit RPC privileges, including helper functions used by SECURITY INVOKER callers.
do $$ declare r record;
begin
  for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid
    where n.nspname='public' and p.proname like 'daywise_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',r.signature);
    if r.signature::text not like '%immutable_identity%' then
      execute format('grant execute on function %s to authenticated',r.signature);
    end if;
  end loop;
end $$;
