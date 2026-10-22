-- Integer paise, domain-compatible JSON field names, and owner-qualified parents.
create domain public.daywise_month as text
  check (value ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and value between '1900-01' and '2200-12');
create domain public.daywise_minor as bigint check (value between 0 and 100000000000);
create table public.profiles (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "displayName" text not null check (length(trim("displayName")) between 1 and 50),
  "createdAt" timestamptz not null default now(),
  demo boolean not null default false,
  theme text not null default 'light' check (theme in ('light','dark','system')),
  "onboardingComplete" boolean not null default false,
  unique (owner_id, id)
);
create table public.income_revisions (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "profileId" text not null,
  "effectiveMonth" public.daywise_month not null,
  "amountMinor" public.daywise_minor not null,
  currency text not null default 'INR' check (currency = 'INR'),
  unique ("profileId", "effectiveMonth"),
  foreign key (owner_id, "profileId") references public.profiles(owner_id, id) on delete cascade
);
create table public.recurring_sources (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "profileId" text not null,
  unique (owner_id, "profileId", id),
  foreign key (owner_id, "profileId") references public.profiles(owner_id, id) on delete cascade
);
create table public.recurring_revisions (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "profileId" text not null,
  "sourceId" text not null,
  "effectiveMonth" public.daywise_month not null,
  name text not null check (length(trim(name)) between 1 and 100),
  category text not null check (length(category) between 1 and 60),
  "amountMinor" public.daywise_minor not null check ("amountMinor" > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  frequency text not null default 'monthly' check (frequency = 'monthly'),
  active boolean not null,
  "startMonth" public.daywise_month not null,
  "endMonth" public.daywise_month,
  "paymentDay" integer check ("paymentDay" between 1 and 31),
  notes text not null default '' check (length(notes) <= 2000),
  check ("endMonth" is null or "endMonth" >= "startMonth"),
  unique ("profileId", "sourceId", "effectiveMonth"),
  foreign key (owner_id, "profileId", "sourceId") references public.recurring_sources(owner_id, "profileId", id) on delete cascade,
  foreign key (owner_id, "profileId") references public.profiles(owner_id, id) on delete cascade
);
create table public.monthly_plans (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "profileId" text not null,
  "yearMonth" public.daywise_month not null,
  "monthlyIncomeMinor" public.daywise_minor not null,
  "incomeOverride" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  unique (owner_id, "profileId", "yearMonth"),
  unique ("profileId", "yearMonth"),
  foreign key (owner_id, "profileId") references public.profiles(owner_id, id) on delete cascade
);
create table public.monthly_commitments (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "profileId" text not null,
  "yearMonth" public.daywise_month not null,
  "sourceId" text,
  name text not null check (length(trim(name)) between 1 and 100),
  category text not null check (length(category) between 1 and 60),
  "amountMinor" public.daywise_minor not null check ("amountMinor" > 0),
  origin text not null check (origin in ('recurring','one-time')),
  paid boolean not null default false,
  "monthOverride" boolean not null default false,
  excluded boolean not null default false,
  "paymentDay" integer check ("paymentDay" between 1 and 31),
  notes text not null default '' check (length(notes) <= 2000),
  check ((origin = 'recurring' and "sourceId" is not null) or (origin = 'one-time' and "sourceId" is null)),
  unique ("profileId", "yearMonth", "sourceId"),
  foreign key (owner_id, "profileId", "yearMonth") references public.monthly_plans(owner_id, "profileId", "yearMonth") on delete cascade,
  foreign key (owner_id, "profileId", "sourceId") references public.recurring_sources(owner_id, "profileId", id),
  foreign key (owner_id, "profileId") references public.profiles(owner_id, id) on delete cascade
);
create table public.daily_expenses (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "profileId" text not null,
  date date not null check (date between '1900-01-01' and '2200-12-31'),
  "amountMinor" public.daywise_minor not null check ("amountMinor" > 0),
  category text not null check (length(trim(category)) between 1 and 60),
  description text not null check (length(trim(description)) between 1 and 100),
  time text check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  notes text not null default '' check (length(notes) <= 2000),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  foreign key (owner_id, "profileId") references public.profiles(owner_id, id) on delete cascade
);
create table public.categories (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "profileId" text not null,
  name text not null check (length(trim(name)) between 1 and 60),
  type text not null check (type in ('daily', 'commitment')),
  unique ("profileId", type, name),
  foreign key (owner_id, "profileId") references public.profiles(owner_id, id) on delete cascade
);
create table public.local_migrations (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_profile text not null check (length(source_profile) between 1 and 500),
  profile_id text,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, source_profile),
  foreign key (owner_id, profile_id) references public.profiles(owner_id,id) on delete set null (profile_id)
);
create index expenses_profile_date on public.daily_expenses("profileId", date);
create index recurring_profile_month on public.recurring_revisions("profileId", "effectiveMonth");
create index commitments_profile_month on public.monthly_commitments("profileId", "yearMonth");
-- Ownership/identity cannot be moved by UPDATE, including between one's own profiles.
create function public.daywise_immutable_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id or
     (to_jsonb(new)->'id') is distinct from (to_jsonb(old)->'id') or
     (to_jsonb(new)->'profileId') is distinct from (to_jsonb(old)->'profileId') then
    raise exception 'Record ownership and identity are immutable' using errcode = '42501';
  end if;
  return new;
end $$;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
create policy own_select on public.profiles for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy own_update on public.profiles for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_delete on public.profiles for delete to authenticated using ((select auth.uid()) = owner_id);
create index profiles_owner on public.profiles(owner_id);
create trigger immutable_identity before update on public.profiles for each row execute function public.daywise_immutable_identity();
alter table public.income_revisions enable row level security;
alter table public.income_revisions force row level security;
revoke all on public.income_revisions from public, anon, authenticated;
grant select, insert, update, delete on public.income_revisions to authenticated;
create policy own_select on public.income_revisions for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_insert on public.income_revisions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy own_update on public.income_revisions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_delete on public.income_revisions for delete to authenticated using ((select auth.uid()) = owner_id);
create index income_revisions_owner on public.income_revisions(owner_id);
create trigger immutable_identity before update on public.income_revisions for each row execute function public.daywise_immutable_identity();
alter table public.recurring_sources enable row level security;
alter table public.recurring_sources force row level security;
revoke all on public.recurring_sources from public, anon, authenticated;
grant select, insert, update, delete on public.recurring_sources to authenticated;
create policy own_select on public.recurring_sources for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_insert on public.recurring_sources for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy own_update on public.recurring_sources for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_delete on public.recurring_sources for delete to authenticated using ((select auth.uid()) = owner_id);
create index recurring_sources_owner on public.recurring_sources(owner_id);
create trigger immutable_identity before update on public.recurring_sources for each row execute function public.daywise_immutable_identity();
alter table public.recurring_revisions enable row level security;
alter table public.recurring_revisions force row level security;
revoke all on public.recurring_revisions from public, anon, authenticated;
grant select, insert, update, delete on public.recurring_revisions to authenticated;
create policy own_select on public.recurring_revisions for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_insert on public.recurring_revisions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy own_update on public.recurring_revisions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_delete on public.recurring_revisions for delete to authenticated using ((select auth.uid()) = owner_id);
create index recurring_revisions_owner on public.recurring_revisions(owner_id);
create trigger immutable_identity before update on public.recurring_revisions for each row execute function public.daywise_immutable_identity();
alter table public.monthly_plans enable row level security;
alter table public.monthly_plans force row level security;
revoke all on public.monthly_plans from public, anon, authenticated;
grant select, insert, update, delete on public.monthly_plans to authenticated;
create policy own_select on public.monthly_plans for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_insert on public.monthly_plans for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy own_update on public.monthly_plans for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_delete on public.monthly_plans for delete to authenticated using ((select auth.uid()) = owner_id);
create index monthly_plans_owner on public.monthly_plans(owner_id);
create trigger immutable_identity before update on public.monthly_plans for each row execute function public.daywise_immutable_identity();
alter table public.monthly_commitments enable row level security;
alter table public.monthly_commitments force row level security;
revoke all on public.monthly_commitments from public, anon, authenticated;
grant select, insert, update, delete on public.monthly_commitments to authenticated;
create policy own_select on public.monthly_commitments for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_insert on public.monthly_commitments for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy own_update on public.monthly_commitments for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_delete on public.monthly_commitments for delete to authenticated using ((select auth.uid()) = owner_id);
create index monthly_commitments_owner on public.monthly_commitments(owner_id);
create trigger immutable_identity before update on public.monthly_commitments for each row execute function public.daywise_immutable_identity();
alter table public.daily_expenses enable row level security;
alter table public.daily_expenses force row level security;
revoke all on public.daily_expenses from public, anon, authenticated;
grant select, insert, update, delete on public.daily_expenses to authenticated;
create policy own_select on public.daily_expenses for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_insert on public.daily_expenses for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy own_update on public.daily_expenses for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_delete on public.daily_expenses for delete to authenticated using ((select auth.uid()) = owner_id);
create index daily_expenses_owner on public.daily_expenses(owner_id);
create trigger immutable_identity before update on public.daily_expenses for each row execute function public.daywise_immutable_identity();
alter table public.categories enable row level security;
alter table public.categories force row level security;
revoke all on public.categories from public, anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated;
create policy own_select on public.categories for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_insert on public.categories for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy own_update on public.categories for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_delete on public.categories for delete to authenticated using ((select auth.uid()) = owner_id);
create index categories_owner on public.categories(owner_id);
create trigger immutable_identity before update on public.categories for each row execute function public.daywise_immutable_identity();
alter table public.local_migrations enable row level security;
alter table public.local_migrations force row level security;
revoke all on public.local_migrations from public, anon, authenticated;
grant select, insert, update, delete on public.local_migrations to authenticated;
create policy own_select on public.local_migrations for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_insert on public.local_migrations for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy own_update on public.local_migrations for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_delete on public.local_migrations for delete to authenticated using ((select auth.uid()) = owner_id);
create index local_migrations_owner on public.local_migrations(owner_id);
create trigger immutable_identity before update on public.local_migrations for each row execute function public.daywise_immutable_identity();
-- Receipts survive profile deletion, preventing a delayed retry from re-importing it.
revoke update, delete on public.local_migrations from authenticated;
revoke all on function public.daywise_immutable_identity() from public, anon, authenticated;
grant usage on schema public to authenticated;
