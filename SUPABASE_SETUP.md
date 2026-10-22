# Spendense Supabase setup

**Current deployment policy:** keep `NEXT_PUBLIC_APP_MODE=maintenance` (default) or `staging` until authentication, migrations, and RLS have been validated and activation is approved. Both modes disable local/cloud financial operations and sign-in. Existing IndexedDB records are retained. `live` restores the full existing application. See [DEPLOYMENT_REPORT.md](DEPLOYMENT_REPORT.md) for current frontend validation; the database procedures below are operator instructions requiring separate approval, not commands executed during deployment preparation.

## Disposable local verification

Requires Node 22+, Docker Desktop, and installed dependencies.

```sh
npm install
npm run db:start
npx supabase migration up --local
npm run db:test
npm run test:cloud
```

`db:start` starts only this project's local Supabase stack. `db:test` executes pgTAP with synthetic users inside rolled-back test transactions. `test:cloud` reads the local CLI status, forwards **only** URL and publishable key to the test Next.js server, and uses Mailpit email links. It runs on port 3100 with a separate `.next-e2e` directory. Test browser contexts and cloud records are synthetic; guest IndexedDB in your normal browser is not touched. Local email rate limits are raised for repeatable testing; hosted rate limits should be configured independently.

For an existing local stack, `npx supabase migration up --local` applies pending migrations while retaining its records. Reserve `npx supabase db reset --local` for an explicitly disposable database: it deletes local database records. Never reset a database containing records you need. `npx supabase stop` preserves local database volumes.

The local test stack enables email confirmation and an eight-character password minimum. Read test confirmation and sign-in emails at http://127.0.0.1:54324. `test:cloud` overrides the URL, publishable key, and app origin only for the test processes; your configured `.env.local` stays intact. The default `test:e2e` suite clears cloud credentials explicitly. Use the same hostname throughout; localhost and 127.0.0.1 have different cookie/IndexedDB origins.

## Hosted Supabase

1. Use the project whose URL and publishable key are already configured in `.env.local`. Review and apply all three versioned SQL migrations in `supabase/migrations`, following the exact CLI procedure below. Do not use cloud finance before the migrations/RLS are applied. Run `npm run db:test` locally first and repeat authorization acceptance against a disposable hosted staging database before a production launch.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the canonical HTTPS `NEXT_PUBLIC_APP_URL` in your deployment environment. Legacy anon JWT keys are supported; publishable keys are preferred. Never use `sb_secret_*`, a service-role JWT, database password, or JWT signing secret in any `NEXT_PUBLIC_*` variable. Restart/rebuild Next.js after changing public variables.
3. In Supabase Auth URL Configuration, set the Site URL to your app origin. Allow **exact** redirect URLs such as `https://your-app.example/auth/callback`; include `http://127.0.0.1:3000/auth/callback` only for development. Avoid broad production wildcards.
4. Optional: enable Google in Authentication → Providers using a Google Cloud OAuth web client if you want to offer the existing Google entry point. Email authentication does not require it. Configure Google's authorized callback to the **Supabase Auth** callback shown by the dashboard (`https://PROJECT.supabase.co/auth/v1/callback`), and configure your app callback in Supabase's allowlist. Add your Google test users/consent screen as required. Provider secrets belong in the Supabase dashboard, never the app bundle.
5. In Authentication → Providers → Email, enable email sign-up/sign-in and **Confirm email**. Set the password minimum to at least eight characters. Configure production SMTP, sender identity, confirmation/sign-in templates, and delivery/rate limits. Keep `{{ .ConfirmationURL }}` in both templates; the app uses PKCE and exchanges the callback's `code`. Open links in the browser where sign-up/sign-in started. Email/password sign-in works after confirmation. For a forgotten password, use the email sign-in link, then Manage account → Change password. The callback rejects invalid/expired codes and offers a fresh sign-in.
6. Use HTTPS. Ensure your reverse proxy forwards the app's correct public host and never caches authenticated responses or Set-Cookie. Set `NEXT_PUBLIC_APP_URL` explicitly. Review CSP/XSS protection, auth rate limits, account recovery, backups, monitoring, and your deployment's logging/redaction policy.

## Exactly how to apply the migrations

**These instructions are for the operator to run after approving the target and SQL. No hosted migration, linking, or deployment was run by this task.** The app's publishable key cannot apply SQL migrations; use your own Supabase CLI login and database password when prompted. Never put database credentials in `NEXT_PUBLIC_*` variables.

First review these ordered files:

```text
supabase/migrations/202610220001_schema.sql
supabase/migrations/202610220002_operations.sql
supabase/migrations/202610220003_payment_state.sql
```

From the application directory, authenticate and link to the **staging** project reference shown in its Supabase dashboard (the project reference is the subdomain in a standard `https://PROJECT_REF.supabase.co` URL):

```sh
cd /Users/likhithreddy/Documents/daywise
npx supabase login
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
```

Check the target project and pending migration list. For a fresh project, all three must be pending. If migrations 001/002 already exist in its migration history, only 003 should be pending. If tables exist but migration history is absent or differs, stop and reconcile the existing schema/history first; do not drop tables or mark migrations applied without verifying their contents.

After approving that concrete staging plan, apply pending files in timestamp order and verify recorded history:

```sh
npx supabase db push
npx supabase migration list
```

`db push` records successfully applied migrations and skips those already recorded. Do not edit previously applied files. Do not run `db reset --linked` or `db reset --db-url` against an existing hosted database. See [Supabase's migration workflow](https://supabase.com/docs/guides/deployment/database-migrations) and [CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push).

In the target's SQL Editor, the following read-only query should return nine rows, each with `rls_enabled = true` and `rls_forced = true`:

```sql
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles', 'income_revisions', 'recurring_sources', 'recurring_revisions',
    'monthly_plans', 'monthly_commitments', 'daily_expenses', 'categories',
    'local_migrations'
  )
order by c.relname;
```

Configure the staging app's environment to match that project, rebuild/restart, and complete the hosted acceptance checks below. Production is a **separate approval**: take a database backup, review the same SQL, explicitly link `YOUR_PRODUCTION_PROJECT_REF`, and repeat migration-list/dry-run before approving `db push`. Never infer production approval from a staging run. Keep the app release that calls `daywise_set_paid` behind application rollout until migration 003 is applied.

## Acceptance before production

Run lint, typecheck, unit tests, guest Playwright, build, pgTAP, and local cloud Playwright. Then run actual email confirmation/password sign-in and recovery on the hosted staging origin, refresh/expiry/logout, two-account isolation and forbidden REST/RPC access, migration rollback/retry, and independent-device persistence. Verify Google only if enabled. Re-run authorization acceptance against the schema/grants that will actually be deployed. Do not interpret local tests as proof of hosted provider setup or production security.

Signing in uploads no guest records. Account → Import a local profile → Review → Download backup → consent → Import creates a separate cloud workspace. Existing cloud histories are never merged/replaced; unchanged retries do not duplicate the import. Local originals remain available in Local mode.

If an import's response was interrupted, retry the same unchanged backup. If the local profile has since changed, the receipt prevents silent merging and reports a conflict. Keep the original backup; a merge/second-history workflow is deliberately not provided.

## Operational limits

Cloud mode requires network access and has no offline write queue. Browser-only guest mode is still supported. The app does not add a service worker. Exports/history currently read a whole profile; large datasets require pagination/streaming before heavy production use. Standard profile/category listing uses Supabase's configured row cap. Import is one request/transaction; provider request size and execution limits may reject very large backups atomically. Failed imports leave local data intact. Same-record edits from two devices have no conflict resolution UI.

See `SUPABASE_IMPLEMENTATION_REPORT.md` for current evidence and remaining hosted checks; `STAGE_3_REPORT.md` retains the earlier implementation history.
