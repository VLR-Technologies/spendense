# Spendense deployment preparation

Validated 22 October 2026, Europe/Berlin.

**Result: frontend ready for an approved Vercel maintenance/staging deployment. Financial launch remains blocked pending real-backend validation and approval.** No database migrations, Supabase linking/reset, hosted financial operations, Vercel deployment, workspace Git initialization, commit, or push were performed. No replacement backend or application credentials were created.

## Repository and runtime

This is one application at the workspace root, `/Users/likhithreddy/Documents/daywise`, rather than a monorepo. The supplied directory has no `.git` metadata. Actual installed versions come from `package-lock.json`, not just dependency ranges:

| Item | Inspection result |
| --- | --- |
| Framework | Next.js 16.4.2 App Router; React / React DOM 19.3.1 |
| Language/tooling | TypeScript 5.9.3 (strict), ESLint 10.13.0 / eslint-config-next 16.4.2 |
| Styling | Tailwind CSS 4.3.3, locally bundled Manrope and DM Sans fonts |
| Local storage | Dexie 4.4.6 / IndexedDB; unchanged version-1 schema |
| Cloud adapters | `@supabase/ssr` 0.12.7; `@supabase/supabase-js` 2.118.0 |
| Runtime tested | Node.js 22.23.1, npm 10.9.8; select Node 22.x on Vercel (22.13+ needed for ESLint 10) |
| Dependency install | `npm ci`; commit `package-lock.json` and `.npmrc` (`legacy-peer-deps=true`) |
| Development | `npm run dev` (`next dev --hostname 127.0.0.1`) |
| Build | `npm run build` (`next build --webpack`) |
| Start locally | `npm start` (`next start --hostname 127.0.0.1`) |
| Vercel validation/build | `npm run validate:deployment` |

`src/app` contains `/`, `/dashboard`, `/calendar`, `/monthly-plan`, `/expenses`, `/insights`, `/settings`, `/api/auth`, and `/auth/callback`. `src/proxy.ts` handles session refresh. `src/components` retains the existing UI. `src/lib/finance.ts` implements exact paise calculations. Local and cloud repositories continue to share the existing contract. SQL migrations and pgTAP tests remain in `supabase/`; they are not installation/build hooks.

Next.js's installed guides for deployment, environment variables, Proxy, Route Handlers, ESLint, and TypeScript were read before changing code. This is a full Next.js deployment, not a static export: auth Route Handlers and Proxy are retained. Vercel supplies the runtime; the localhost `start` command is for local validation. Docker, Supabase CLI login, a database connection, and external font downloads are not required to build the frontend. A fresh install still needs access to the package registry and dependency installation assets.

## Deployment lock and unavailable Supabase

`NEXT_PUBLIC_APP_MODE` is a build-time opt-in:

| Value | Result |
| --- | --- |
| Missing, empty, unrecognized, or `maintenance` | Branded maintenance page on every finance route |
| `staging` | Same locked page, labeled “Staging preview” |
| Exact value `live` | Full existing application, including local guest workspaces and configured cloud accounts |

Both locked modes prevent **all** financial work, including local entry/import, rather than merely hiding a cloud button. The provider returns before workspace hooks, IndexedDB opening, session checks, and auth subscriptions. Both repository adapters guard reads/writes, and cloud client factories and Proxy session refresh are disabled. Direct `/api/auth` and `/auth/callback` requests return 503 with private/no-store and Retry-After headers; no auth code is exchanged. Pages return 200 with honest maintenance messaging, `noindex` metadata, and `X-Robots-Tag`. There is no browser switch to enable finance.

The preview contains no income, balances, transactions, seeded profiles, or sample money. Existing browser records are not reset, imported, or displayed. It is a holding page, not an interactive financial sandbox. Enabling `live` restores the same product UI and repositories without restructuring them. The existing demo remains a separately selected, labeled workspace only in the enabled app; guest workspaces begin empty.

Missing or incomplete Supabase settings disable cloud clients. Malformed URLs, insecure non-loopback HTTP URLs, and unrecognized keys also disable cloud access. `next.config.ts` removes invalid/incomplete backend values from the build process environment before browser bundling; it does not edit local env files. A secret key or elevated legacy JWT instead stops the build. Secret-like `NEXT_PUBLIC_*` variable names are also rejected. Only publishable keys or legacy JWTs with the `anon` role are accepted; no service-role client is implemented.

The existing `.env.local` contains an unrecognized key. Its contents were not printed, changed, copied into documentation, or used to contact the hosted backend. The build reports cloud configuration as disabled. A browser-asset check confirmed that this unrecognized local key was absent from `.next/static`. Vercel must receive its own correct settings; do not upload the local env file.

In `live` mode, Supabase requests have an eight-second per-request deadline and retain caller cancellation; the browser's session verification has a twelve-second deadline. Missing table/RPC errors produce an explicit “Cloud storage is not ready” message. Outages retain recoverable errors without fabricated financial records or automatic local/cloud data substitution. A timed-out mutation may already have reached the server: refresh and verify before retrying. Nothing queues financial changes offline.

The lock is an application rollout safeguard. Changing any `NEXT_PUBLIC_*` value requires rebuilding/redeploying. It cannot revoke an older live deployment, cached JavaScript, existing sessions, or direct access to Supabase APIs. RLS and backend authorization must be validated independently. Keep Preview deployments protected and keep the mode locked until the checklist is complete.

## Vercel settings

`vercel.json` explicitly selects Next.js and the install/build commands. Root Directory and Node version must also be checked in Project Settings. There is no deployment command in this repository's validation pipeline.

| Setting | Required value |
| --- | --- |
| Project name | `spendense` (or an approved unique Spendense project name) |
| Framework Preset | **Next.js** (`nextjs` in `vercel.json`) |
| Root Directory | `.` / the directory containing `package.json` and `next.config.ts`; **not** `src` or `src/app` |
| Install Command | `npm ci` |
| Build Command | `npm run validate:deployment` |
| Output Directory | Leave the Next.js preset default (`.next`); no custom static output directory |
| Node.js Version | **22.x**; also constrained by `package.json` engines and `.nvmrc` |
| Development Command | Preset/default, or `npm run dev` for local Vercel tooling |
| Initial deployment target | An explicitly approved, protected **Preview** deployment in locked mode |

If the app is later placed in a larger repository, Root Directory must be the app's relative subdirectory. No Git remote or Vercel project could be inferred from this supplied folder. Do not set `DAYWISE_TEST_DIST_DIR`, `DAYWISE_CLOUD_TEST`, or test-only `SPENDENSE_TEST_*` variables on Vercel. No `DATABASE_URL`, Supabase password, access token, JWT signing secret, or service-role key is needed by the app. Do not override `NODE_ENV`.

Set environment scopes deliberately; keep both Preview and Production locked until their individual activation is approved:

| Environment-variable name | Safe frontend preparation | Future validated backend |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_MODE` | `maintenance` (recommended), or `staging` for locked Preview | `live` only after validation and approval |
| `NEXT_PUBLIC_SUPABASE_URL` | Leave unset/empty | Actual project's HTTPS API origin |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Leave unset/empty | Actual browser-safe publishable key or legacy anon JWT |
| `NEXT_PUBLIC_APP_URL` | Leave unset/empty until an approved origin exists | Exact canonical HTTPS application origin, no path, e.g. the approved Spendense domain |

Use the real project and real origin when available. No placeholder credentials, temporary database, or synthetic backend is needed for maintenance. Public variables are visible in JavaScript; they are not a place to store secrets. Vercel environment changes take effect in a new deployment, not in an already-built frontend.

Official configuration references: [Vercel build settings](https://vercel.com/docs/builds/configure-a-build), [project configuration](https://vercel.com/docs/project-configuration), [supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), and [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

## Credentials and version control

- `.gitignore` excludes all `.env*` files except `.env.example`, Vercel local state, private-key/certificate files, credential JSON patterns, logs, build output, browser artifacts, and backup JSON patterns. The example contains only mode selection and empty backend/origin values.
- `.vercelignore` additionally excludes local environment files, keys, credential dumps, generated output, and browser artifacts from CLI uploads. Configure settings in Vercel rather than copying an env file into the deployment.
- `npm run check:secrets` checks source files for known secret formats without printing matches. With Git available it also rejects tracked env/key files and examines staged changes, so a cleaned working file cannot conceal a staged secret. The Vercel build runs this check.
- `.githooks/pre-commit` runs the same check. Once this folder is in the intended repository, enable it with `git config core.hooksPath .githooks`. No hook was installed into an unrelated repository and no Git repository was initialized here.
- Ignore rules and scanners are safeguards, not proof of clean Git history. Because this folder has no Git metadata, tracked files, prior commits, remote history, and previously exposed credentials could not be audited. Before approving any commit/push, inspect the actual repository's staged diff/history and rotate any credential that was exposed. Automated pattern detection does not recognize every possible arbitrary password.

## Branding and preserved behavior

Wordmarks, title, application-name metadata, accessible labels, onboarding, Settings/account copy, download prefixes, and current documentation use **Spendense**. The remaining user-facing account error now explains guest availability without asking end users to follow a developer setup file. The maintenance screen reuses the fonts, colors, wordmark, and welcome-page layout. Historical reports are explicitly marked as historical and link here for current deployment policy.

Legacy database/storage keys, backup `format: "daywise"`, RPC names, deterministic import namespaces, technical class/test names, and the existing workspace path remain compatible. Stored user-authored text is not rewritten. The existing built-in legacy demo name is still translated for display only. These compatibility references in technical documentation are intentional.

SHA-256 comparisons confirmed byte-for-byte preservation of the finance engine, IndexedDB schema, validation schemas, migration transformation, calendar, expense, monthly-plan, form, dashboard and insights components, and all three SQL migrations. Repository changes add deployment guards and cloud readiness messaging; financial algorithms are unchanged. The logo was extracted without changing its markup. Existing styling is retained, with added styles scoped to the holding page.

## Validation evidence

| Check | Result |
| --- | --- |
| Baseline lint / TypeScript / unit/component tests | PASS; 66 tests before deployment changes |
| `npm run validate:deployment` | PASS: credential check, lint, type generation, strict TypeScript, 82 tests across 7 files, production Webpack build |
| Final validation/build with explicit `maintenance` and empty backend/origin settings | PASS; final `.next` output is locked, ready for a frontend-only Preview |
| Full application `npm run test:e2e` | PASS: 23 passed, 5 intentionally skipped across desktop/mobile |
| Built production maintenance frontend `SPENDENSE_TEST_PRODUCTION=1 npm run test:deployment` | PASS: 2 tests, desktop/mobile |
| Locked staging `SPENDENSE_TEST_APP_MODE=staging npm run test:deployment` | PASS: 2 tests, desktop/mobile; local SDK assets correctly distinguished from backend traffic |
| Production build with explicit `live` and empty backend settings | PASS; confirms full frontend remains buildable without Supabase |
| Sensitive-path Git ignore check in a temporary isolated repository | PASS; `.env` variants/key/state paths ignored, `.env.example` trackable |
| Credential scanner self-check in a temporary isolated repository | PASS; tracked env blocked without printing values; staged private-key marker caught after cleaning working copy; clean files accepted |
| `npm ci --dry-run --ignore-scripts --offline` | PASS: lockfile accepted; Linux x64/arm64 Next SWC and Tailwind native dependencies are present |
| Unrecognized local key in built browser assets | PASS: absent |
| Protected-source SHA-256 comparisons | PASS: financial/UI/schema/migration files listed above unchanged |
| Hosted Supabase authentication, database migrations, RLS, email delivery | NOT RUN; intentionally outside this preparation |
| Vercel remote build, domain/TLS, release | NOT RUN; requires deployment approval |

The five browser skips are the email/password cloud test and the cloud import/isolation test on both devices (four), plus the desktop duplicate of a mobile-only responsive test (one). Cloud test skip status is not evidence that the hosted backend works. Unit mocks and isolated browser demo fixtures are test artifacts; they are not deployment credentials or displayed financial records in maintenance.

The installed tree reports six extraneous optional native/WASM support packages and no missing direct dependencies. No dependency versions were changed. The install check was a dry run; a fresh Linux install and Vercel remote build remain to be verified in the approved Preview deployment.

The existing E2E journeys cover integer-paise budgets, income scopes, recurring revisions, pause/resume, payment metadata, calendar keyboard behavior, expense CRUD, backups/imports, history compatibility, storage failures, themes and responsive layouts. The deployment tests check every finance route, Spendense branding, absence of sample currency and finance controls, no IndexedDB opening or service/auth requests, preserved profile selection, and direct auth-route rejection. Desktop/mobile screenshots were visually reviewed. Sandbox port restrictions required local-server permission for browser tests; all servers remained local and no cloud test stack was started.

## Known limits and final launch checklist

This preparation validates a maintenance frontend, not real-account financial readiness. The supplied SQL describes intended ownership/RLS, but no claim is made that any hosted project has those migrations or policies. Local guest data remains tied to its browser origin; moving to a new Vercel/domain origin does not transfer browser data. The app remains INR-only with its existing connectivity/concurrency limits. There is no new background synchronization, bank integration, service worker, or database provisioning.

1. [ ] Review these local changes and this report. Add the project to the intended Git repository; enable the credential hook, inspect staged files/history, and approve any commit/push separately.
2. [ ] Approve a protected Vercel Preview deployment. Use the settings above with `maintenance` or `staging` and empty backend settings. Verify the hosted holding page, every finance URL, 503 auth responses, no Supabase traffic, no indexing, and HTTPS. Keep Production locked.
3. [ ] When migrations become available, obtain explicit approval for the target project and SQL. Back up any existing data. Apply all three reviewed migrations in order: `202610220001_schema.sql`, `202610220002_operations.sql`, and `202610220003_payment_state.sql`. No frontend build applies them.
4. [ ] Validate the real staging backend independently: all nine exposed tables force RLS; anonymous access is denied; two authenticated accounts cannot read/change each other's records, owners, child references, or RPC/import results. Check SECURITY INVOKER grants, migration receipts, transaction rollback and payment-state idempotency. Run the database tests only with approval.
5. [ ] Configure actual publishable credentials, the canonical HTTPS origin, Supabase Site URL, and exact `/auth/callback` allowlist for each approved origin. Enable email confirmation, production SMTP/sender delivery, recovery flows, rate limits, and optional Google credentials in Supabase. Do not use a service-role key in this app.
6. [ ] After the preceding backend checks pass, approve enabling `live` on a protected staging app for full acceptance. Rebuild with real settings; verify sign-up/confirmation, sign-in/out, session refresh/expiry, password recovery, denied cross-account access, unavailable-service recovery, all finance views, recurring behavior and consented import with exact totals. Retain the original local profile/backup.
7. [ ] Approve production activation/release separately. Confirm the actual production project's migrations/RLS/auth settings, environment scope, domain/TLS, backups, monitoring and redacted logs. Run `npm run validate:deployment` and required browser checks on the release source, then approve a new `live` build/deployment.
8. [ ] Keep a rollback path to a new locked maintenance build. A locked build does not revoke previous sessions or direct API access; use backend access controls and Vercel deployment controls as required. Confirm the public aliases point only to the approved deployment.

Until those approvals and checks are complete, leave `NEXT_PUBLIC_APP_MODE=maintenance` and do not accept real financial records on the hosted frontend.
