# Spendense

**Make every day count.** A personal finance application with exact daily budgets, local browser persistence, and optional Supabase accounts.

**Deployment status:** maintenance is the safe default. The Spendense holding page disables sign-in and all financial reads/writes, including local workspaces. Set `NEXT_PUBLIC_APP_MODE=staging` for the same locked staging preview. Only the explicit value `live` enables the existing application; approve backend authentication, migrations, and RLS validation before enabling it on a hosted environment. See [DEPLOYMENT_REPORT.md](DEPLOYMENT_REPORT.md) for Vercel settings, current evidence, and the launch checklist. No deployment or migration is performed by the build.

The current product name is **Spendense**. The existing workspace folder, storage keys, backup format, and database identifiers retain legacy names for compatibility; see [the rebranding report](REBRANDING_REPORT.md). Optional Supabase email/password accounts, confirmed email links, and cloud persistence are implemented. Hosted activation requires applying the migrations after approval; see [SUPABASE_INTEGRATION.md](docs/SUPABASE_INTEGRATION.md).

## Run locally

Requires Node.js 22.13 or newer in the 22.x release line and npm. No credentials or database server are required to build or open the maintenance frontend.

```sh
cd /Users/likhithreddy/Documents/daywise
npm ci
npm run dev
```

Open [Spendense on localhost](http://127.0.0.1:3000). It shows the maintenance page until explicitly enabled. Copy `.env.example` to `.env.local` only if needed; keep credentials outside version control and leave Supabase values empty while the backend is unavailable. Unrecognized/incomplete configuration disables cloud access; elevated keys stop the build before bundling.

For deliberate local development of the existing application, clear cloud configuration and opt in for that process:

```sh
NEXT_PUBLIC_APP_MODE=live NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run dev
```

The enabled app offers **Continue as guest**, **Create a named local profile**, and **Try the demo**. Guests start with zero income and no invented expenses. Demo records and the welcome-page sample are explicitly labeled and isolated. These samples never appear in the locked preview.

For a production build served locally:

```sh
npm run build
npm start
```

Both servers bind only to `127.0.0.1`. Use the same browser and origin to keep accessing the same IndexedDB data. `localhost` and `127.0.0.1` are different browser storage origins.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:deployment
```

`npm run validate:deployment` runs the credential check, lint, route type generation/TypeScript, unit/component tests, and production build. It is the Vercel build command. `test:e2e` enables the full app only in isolated test browsers with cloud credentials cleared. `test:deployment` checks locked routes on desktop/mobile. For a production-server smoke test, first build in maintenance mode, then run `SPENDENSE_TEST_PRODUCTION=1 npm run test:deployment`.

After adding this folder to your intended Git repository, enable the supplied credential hook with `git config core.hooksPath .githooks`. The check examines working files and staged changes without printing matched values. It also rejects tracked `.env` files (except the empty `.env.example` template). No Git repository was initialized or history changed during deployment preparation.

The Playwright configuration uses installed Google Chrome. Alternatively, run `npx playwright install chromium` and remove `channel: "chrome"` from `playwright.config.ts`. Desktop and iPhone-size Chromium projects run the same end-to-end journeys. Playwright starts an isolated development server on port 3100 using `.next-e2e`. Screenshots are saved under `docs/screenshots/`.

The `.npmrc` selects npm's legacy peer resolver because npm 10's default resolver crashed while processing optional Vitest browser peers. Actual installed package versions are recorded in `package-lock.json`. The build uses Next.js's supported Webpack option because Turbopack's CSS worker could not bind its internal IPC port in the execution sandbox.

## Features

- Dashboard with daily allowance, income, commitments, spending, and cumulative unspent allocation.
- Interactive month/year calendar, accessible date navigation, and day details.
- Exact integer-paise allocations, signed budgets, leap years, and deterministic rounding.
- Per-month income overrides and dated defaults for subsequent months.
- Recurring commitment revisions, start/end months, pause/resume, month-specific edits, and payment metadata.
- Separate one-time monthly commitments and conversion to recurring schedules.
- Daily expense creation, editing, date reassignment, deletion confirmation, categories, search, filtering, sorting, and CSV export.
- Data-driven charts and insights, including category, daily, cumulative, weekly, and month comparison views.
- Separate local profiles, onboarding, demo reset, and per-profile light/dark/system preferences.
- Validated JSON backup and restore, explicit replacement confirmation, duplicate/conflict rejection, and atomic writes.

## Important distinctions

Daily income figures are **budget allocations**, not daily salary receipts. A bill's payment status does not subtract it a second time. Future days are projected allowances and never contribute to cumulative unspent allocation. Unspent allocation is not a verified bank balance.

Guest profiles are local organizational workspaces, not authenticated accounts. Anyone with access to the browser can access local profiles. Cloud profiles belong to a Supabase-authenticated account and require a connection. Signing in never uploads guest records; an explicit import creates a separate cloud profile. Clearing browser data or using private browsing can remove records. Export regular backups from Settings. Currency is INR throughout this release; currencies are never mixed or silently converted.

See [implementation report](docs/IMPLEMENTATION_REPORT.md) and [Supabase integration](docs/SUPABASE_INTEGRATION.md).

For email/password authentication, local Supabase tests, database setup, and consented import, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md), [architecture](docs/ARCHITECTURE.md), and [historical integration evidence](SUPABASE_IMPLEMENTATION_REPORT.md). Database commands in those documents require separate approval; they are not part of frontend validation. The browser test configuration overrides `.env.local` to keep guest tests away from the hosted project.

See the [Stage 2 report](STAGE_2_REPORT.md) for UX refinements, financial explanations, updated desktop/mobile screenshots in both themes, and acceptance results.
