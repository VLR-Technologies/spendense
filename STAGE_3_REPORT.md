# Spendense Stage 3 — Authentication and secure cloud persistence

> Historical implementation evidence. The current release defaults to locked maintenance mode; see [DEPLOYMENT_REPORT.md](DEPLOYMENT_REPORT.md) for deployment preparation and current validation. Earlier test results below were not re-executed against a hosted backend for this task.

Branding note: the current name is **Spendense**. This report records the earlier stage's implementation and test evidence; legacy technical identifiers and historical screenshots may retain the previous name. See [REBRANDING_REPORT.md](REBRANDING_REPORT.md) for this branding-only update.


Date: 22 October 2026. Final assessment: **PARTIAL** — the implementation and local acceptance checks pass; Google OAuth, production email delivery, and hosted-deployment authorization remain externally unverified. This is not a claim of secure production readiness.

## Implemented features

- Optional Supabase accounts with Google OAuth and email magic-link entry points; guest access remains the default without configuration.
- Dedicated browser/server `@supabase/ssr` clients, PKCE callback, server-verified identity, Next.js 16 Proxy refresh, sign-out confirmation, invalid/expired-session recovery, and private/no-store auth responses. Production cookies use Secure and SameSite=Lax.
- Compact violet account controls and Local/Cloud selection in the welcome view, desktop header, mobile header, and Settings; light/dark themes and existing responsive layouts retained.
- A cloud adapter for all six finance routes, including categories, historical insights, profile management, backup/export, income, daily expenses, commitment revisions, payment metadata, and removal.
- Explicit retry/error states for unavailable cloud operations; no automatic financial upload or offline write queue.
- Reviewed, consented, backed-up local-profile import into a separate cloud workspace, with deterministic identifier mapping, transactional counts/totals verification, duplicate prevention, and a result screen. Cloud file restore also requires a backup download and explicit upload consent.

`src/lib/finance.ts` remains unchanged and authoritative. Existing IndexedDB database name, schema version, profile records, and local selection architecture are retained. No banking, AI, automatic sync, deployment, commit, push, or merge was introduced. The supplied directory has no Git repository, so the migration files are versioned on disk for the user's version-control workflow; no commit was made.

## Database schema and security

Migrations:

- `supabase/migrations/202610220001_schema.sql`
- `supabase/migrations/202610220002_operations.sql`

The schema contains `profiles`, `income_revisions`, `recurring_sources`, `recurring_revisions`, `monthly_plans`, `monthly_commitments`, `daily_expenses`, `categories`, and `local_migrations`.

`daywise_minor` is a PostgreSQL BIGINT domain with the existing per-record 0–100,000,000,000 paise range. Positive expense/commitment checks, INR currency checks, date/month constraints, metadata validation, and unique keys preserve domain integrity. Recurring revisions retain stable source IDs; monthly snapshots retain origin, paid, exclusion, and override flags. Historical revisions and one-time commitments remain distinct. Payment toggling changes only status and does not deduct again.

Every table enables and forces RLS. Separate policies cover SELECT, INSERT, UPDATE, DELETE with `auth.uid() = owner_id`; updates include both USING and WITH CHECK. Table grants to PUBLIC/anon are revoked. Authenticated grants are explicit; migration receipts are read/insert only. Immutable-identity triggers reject owner/ID/workspace reassignment. Composite owner-qualified foreign keys protect workspace, plan, and recurring-source references. Migration receipts reference an owned workspace and keep a nullable reference after its deletion, preventing delayed retries from recreating it.

All RPCs are SECURITY INVOKER, use an empty search path, qualify objects, and retain RLS. Workspace row locks serialize compound operations. Materialization and revision propagation are atomic; export has a coherent transaction boundary. Import checks the expected account against `auth.uid()`, serializes the account/source pair with an advisory transaction lock, and commits profile/children/receipt together only after verification. Anonymous function execution is revoked.

The application never reads a service-role key. Public configuration rejects secret keys and legacy JWT keys whose role is not anon. Production dependency audit found zero advisories at execution time; full tooling audit findings are noted below.

## Authentication architecture

`src/lib/supabase/{browser,server,config}.ts`, `src/proxy.ts`, `src/app/auth/callback/route.ts`, `src/app/api/auth/route.ts`, and `src/lib/auth.ts` separate SDK/auth logic from views.

Proxy uses verified `getClaims()` for refresh and forwards updated cookies to the downstream request and browser. The callback exchanges a PKCE code, verifies claims, and redirects to a fixed dashboard destination. Local loopback origins are retained so localhost/127.0.0.1 cookies are not confused. `NEXT_PUBLIC_APP_URL` provides the production canonical origin. User-supplied redirect destinations are ignored. `/api/auth` uses `getUser()` and returns only minimal verified identity. Server code never authorizes using `getSession()` or local profile identifiers.

Auth changes unmount financial views while verification occurs. Providers are keyed by account and mode; pending reads cancel on unmount, financial state stays in memory, and cloud data is never persisted to guest IndexedDB. Account A's state is absent when account B opens. Failed verification offers local use and retry guidance. Invalid sessions recover to guest data without displaying an old cloud account.

## Repository architecture

`DaywiseRepository` extends the accepted Stage 2 contracts for categories, payment/removal, and profile lifecycle. `LocalRepository` remains the guest adapter. `CloudRepository` maps Postgres rows into the same domain models, normalizes optional nulls/timestamps, and uses authenticated database calls/RPCs. Presentation obtains its repository, categories, and history from the composition root.

Dashboard, calendar, monthly plan, expenses, insights, and settings work in both modes. Exact daily allocations stay in `finance.ts`; the database does not recalculate or round budgets. Cloud operations require a connection and refresh saved data on navigation, focus, reconnect, or manual retry. There is no offline queue or automatic merge.

See [architecture](docs/ARCHITECTURE.md) for details and operating limits.

## Safe migration

1. Sign in and choose an existing local profile. No financial upload occurs at sign-in.
2. Export a point-in-time backup and validate schemas, safe totals, duplicates, profile consistency, recurring sources, categories, and monthly parents.
3. Require a downloadable backup and explicit consent naming the destination account. Cloud JSON file restore also identifies the cloud destination, requires backup download and consent, and cannot silently replace cloud history.
4. Map IDs deterministically using account/profile/collection/source namespaces. SHA-256 identifies the unchanged source independently of export time and array ordering.
5. Insert a separate owned workspace and all records in one authorized transaction. Store an account/source receipt with a unique key.
6. Compare all collection counts and money totals plus each materialized month's income, fixed commitments, and daily spending. SQL checks stored records before commit; the adapter verifies the returned receipt.
7. Report success and retain the original IndexedDB records. Unchanged retries return the same receipt. Changed sources conflict instead of merging. A failed transaction leaves neither partial financial records nor a migration receipt.

Unit tests compare exact day-by-day allocations before and after mapping for 28/29/30/31-day months. Additional mapping cases preserve paid/excluded flags, zero income, negative-budget inputs, and paise; the existing engine tests exercise signed allocation. Actual browser tests compare every collection's record count and monetary total after local-to-cloud export.

## Executed test evidence

The local stack was created specifically for this work with Supabase CLI 2.121.0 and Docker. It applied both migrations from a clean disposable database. No external user's hosted database or normal browser IndexedDB was reset. Browser tests use isolated Chrome contexts; browser restart tests use disposable disk profiles. The task-created Supabase stack was stopped after verification with its database volumes preserved; restart with `npm run db:start`.

| Check | Actual result |
| --- | --- |
| `npm run lint` | PASS, zero lint errors/warnings |
| `npm run typecheck` | PASS; runs Next's installed `typegen` then TypeScript |
| `npm test` | PASS, 59 tests across 5 files, including all 46 accepted existing tests |
| `npm run build` | PASS, Next.js 16.4.2 production Webpack build, all six routes plus auth endpoints/Proxy |
| `npm run test:e2e` | PASS, 21 passed / 3 intentional skips across desktop/mobile |
| `npm run test:cloud` | PASS, 21 passed / 3 intentional skips across desktop/mobile with real local Supabase |
| `npx supabase db reset --local` on the task's disposable stack | PASS; both migrations applied cleanly |
| `npm run db:test` / `npx supabase test db` | PASS, 123 pgTAP assertions across 2 SQL suites |
| Local email/PKCE + cloud browser integration | PASS on desktop and mobile; actual Mailpit links, authenticated RPCs/REST, data import/export |
| Final targeted checks after file-import consent refinement | PASS: 4 passed / 2 intentional skips in guest configuration, then 4 passed / 2 intentional skips with local Supabase; includes offline guest saving and cloud file-import consent |
| Production static asset credential scan | PASS, no elevated-key values or service-role environment references found |
| `npm audit --omit=dev` | PASS, zero production dependency advisories |
| `npm audit` including tooling | FAIL, 5 high advisories in the existing Next ESLint → glob/micromatch/braces chain |
| Actual Google OAuth sign-in | BLOCKED: Google OAuth credentials/consent/provider configuration absent |
| Hosted Supabase / production email delivery / deployed RLS | BLOCKED: no hosted project credentials, SMTP, or deployment configured |

Guest-suite skips are two cloud-only journeys plus the existing desktop duplicate of a mobile-only responsive check. Cloud-suite skips are two unconfigured-installation checks plus that same mobile-only check. These are intentional configuration/project skips, not passed tests.

The 123 database assertions exercise real database roles, not mocked repository filters: forced RLS on every table; cross-user SELECT/UPDATE/DELETE; forged-owner INSERT; anonymous SELECT/INSERT/UPDATE/DELETE; foreign-parent denial; ownership changes; forbidden exports/RPCs/import ownership; coherent financial history; paid metadata; overrides/exclusions; one-time conversion; pause propagation; exact import manifests; retry receipts; rollback; and deleted-workspace retries.

The browser cloud journey additionally makes malicious authenticated HTTP requests as a second real email user: reads/updates/deletes return no foreign rows, export and import ownership attacks fail, cross-user parent inserts fail, and anonymous financial reads are denied. It verifies all six routes, sign-out confirmation, account separation, session refresh from an expired stored timestamp, invalid refresh-token recovery, interrupted-network read retry, independent-device access, account re-login, and persisted cookies/data after fully closing and restarting a separate Chrome process. This is local cloud verification, not a Google/hosted production test.

Initial validation exposed and corrected the callback hostname/cookie issue, a local storage error-copy regression, generated route-type collisions between dev/test build directories, a pgTAP query syntax error, and browser test selector timing/strictness issues. Final reported passes are subsequent executed runs, not predictions. Invalid-token tests intentionally produce local Auth refresh-token diagnostic messages. Existing Dexie index-advice and reduced-motion informational messages remain non-failing.

## Screenshots

Actual browser captures are under [docs/screenshots/stage-3](docs/screenshots/stage-3):

- Desktop/mobile sign-in sheets in light and dark themes (unconfigured state is clearly shown).
- Desktop/mobile authenticated account controls in light and dark themes.
- Desktop/mobile migration review, verified success, and idempotent retry result screens.

Representative captures: [desktop sign-in](docs/screenshots/stage-3/desktop-sign-in-light.png), [mobile sign-in](docs/screenshots/stage-3/mobile-sign-in-dark.png), [desktop import review](docs/screenshots/stage-3/desktop-migration-review.png), [mobile verified import](docs/screenshots/stage-3/mobile-migration-result.png).

## External setup still required

Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Create/configure a hosted Supabase project, apply the migrations, set publishable URL/key and canonical HTTPS app origin, configure exact callback URLs, enable Google with a Google web OAuth client, and configure production SMTP/email templates/rate limits. Execute real Google/email acceptance and two-user/RLS tests against the actual hosted staging deployment before production. No live-provider or hosted-cloud test is marked passed here.

## Known limits and security risks

- Local RLS is verified; hosted grants, schema, proxy/cache behavior, OAuth setup, and email delivery remain unverified. Deployment readiness is not established.
- Supabase's browser SDK shares SSR cookies with JavaScript; they cannot be HttpOnly. Production HTTPS, script/XSS protection, and correct no-store/cache handling remain deployment responsibilities. Secure/SameSite options are configured.
- No offline cloud synchronization, merge, conflict-resolution UI, or realtime subscription. Same-record concurrent edits use the last successful write. After a lost payment-toggle response, reload before manually toggling again.
- Whole-profile export/history currently prioritize consistency over scalability. List endpoints inherit Supabase row caps; very large backup requests may hit transaction/request limits. Such import failures retain local originals and roll back cloud writes.
- Guest operations work locally after the application is loaded. No service worker was introduced; first-load and cold offline navigation are not guaranteed. Local profiles are still accessible to anyone who can access that browser.
- Changed local profiles are not re-imported into an already-imported history. Keep the original backup; automatic merges and repeated divergent history imports are intentionally unavailable.
- Five development-tool audit advisories remain in Next's existing lint dependency chain (including braces stack-exhaustion, GHSA-vfj7-8cjw-p6xm). npm proposes a breaking downgrade of the Next lint configuration, which was not applied. Production dependencies report zero advisories. This does not remove the need for ongoing dependency review.
- Users must keep local backups safe; exported JSON contains financial records. The browser can initiate a download but cannot prove the user retained the file, so explicit acknowledgment is required.

## Final assessment

**PARTIAL.** Guest preservation, cloud adapter behavior, local email authentication, session recovery, transactional migration, exact financial integrity, responsive account UX, and local database isolation have executed passing evidence. Google OAuth and hosted-production acceptance remain blocked by external configuration. Production readiness is not claimed. No commit, push, merge, or deployment was performed.

Primary integration guidance consulted: [Supabase SSR for Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), and the installed Next.js 16 guides in `node_modules/next/dist/docs/` for authentication, Proxy, cookies, Route Handlers, TypeScript, and type generation.
