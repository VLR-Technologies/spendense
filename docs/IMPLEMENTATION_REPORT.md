# Spendense implementation report

> Historical implementation evidence. The current release defaults to locked maintenance mode; see [DEPLOYMENT_REPORT.md](../DEPLOYMENT_REPORT.md) for deployment preparation and current validation. Earlier test results below were not re-executed against a hosted backend for this task.

## Current Supabase integration

The current implementation adds explicit email/password account creation and sign-in, confirmed-email handling, password changes, and safer SSR session/error handling to the existing optional Supabase adapter. Guest IndexedDB data and `src/lib/finance.ts` are unchanged. Three versioned SQL migrations define financial persistence, forced RLS, transactional history/import operations, and retry-safe payment status. No hosted database was modified or deployed.

See [the current integration report](../SUPABASE_IMPLEMENTATION_REPORT.md) for executed checks and remaining hosted acceptance, [integration architecture](SUPABASE_INTEGRATION.md), and [exact migration application instructions](../SUPABASE_SETUP.md). The sections below retain the earlier local release and branding history; their counts and future-work statements describe that historical release.

## Branding update

The application is now branded **Spendense**. This document retains the original local-release implementation and test history below; its historical counts are not the current rebranding results. See [REBRANDING_REPORT.md](../REBRANDING_REPORT.md) for current verification and intentional legacy identifiers. Existing optional cloud code from the later stage is unchanged; no Supabase implementation or activation is part of this rename.

## Delivered application

Spendense is a working Next.js App Router application built in `/Users/likhithreddy/Documents/daywise`. It runs without sign-in, environment variables, Supabase, or an external database. In guest mode, all financial records live in the current browser's IndexedDB database.

The six main routes are Dashboard, Calendar, Monthly Plan, Expenses, Insights, and Settings. The root page opens the guest/profile/demo welcome screen for new visitors and the dashboard for a selected local profile.

## Features

- Income slider from ₹0 to ₹5,00,000 with ₹1,000 steps and direct two-decimal numeric input up to ₹1,00,00,00,000. Values use Indian number formatting, retain nonzero paise in summary displays, and use brief amount transitions. A live preview uses the selected month's real day count and commitments.
- Per-month income overrides, dated income defaults for the selected and subsequent months, and reset to the applicable default. Earlier month snapshots and explicit future income overrides remain stable.
- Recurring commitments with predefined categories, custom names, INR currency, monthly billing, optional payment day, active status, start/end months, and notes. Users can edit one month, change a subsequent default, pause, remove, resume, and record payment status.
- One-time monthly commitments, separately listed and excluded from subsequent months. Switching a one-time item to recurring creates a dated recurring source.
- Interactive calendar with month/year picker, previous/next navigation, date-focused keyboard arrows, today indicator, semantic status colors, negative labels, and neutral future projections. Day details open in a desktop drawer or a mobile bottom sheet and allow adjacent-day navigation.
- Daily expenses support amount, description, category, date, optional time and notes. Creation, editing, reassignment, and confirmed deletion immediately recalculate summaries and charts. Custom categories persist per profile. Search covers description/category/notes; category/date filters and date/amount sorting work within the selected month. CSV exports the current filtered view.
- Dashboard includes all eight requested financial measures, full monthly allocation, elapsed spending pace, daily unspent chart, category mix, calendar, and recent transactions.
- Insights show income, commitments, recorded spending, monthly unspent allocation, elapsed daily average, highest spending day, top category, elapsed days over budget, weekly trends, monthly comparisons, category distribution, daily bars, and a cumulative spending area chart. Text insights are derived from actual recorded totals.
- Guest-first onboarding, named local profiles, separate seeded demo, demo reset, and per-profile light/dark/system appearance.
- JSON export and validated restore, a 20 MB import file limit, rejection of invalid or incompatible records, duplicate checks, profile ownership checks, cross-profile ID conflict rejection, and explicit confirmation before replacing an existing profile.

## Architecture

- `src/app/`: App Router route files, shared layout, global tokens/styles, app icon, error and not-found views.
- `src/components/`: composed pages, charts, calendar and day drawer, forms, profile/onboarding shell, and customized shadcn-style Radix UI primitives.
- `src/lib/finance.ts`: pure allocation, summary, parsing, and formatting functions.
- `src/lib/dates.ts`: local calendar date formatting and date-only month helpers using date-fns.
- `src/lib/db.ts`: versioned Dexie schema and typed tables.
- `src/lib/repositories/`: adapter interfaces and transactional local implementation.
- `src/lib/validation.ts`: Zod validation for user records and versioned backups.
- `src/types/`: domain records.
- `src/tests/`: financial, storage, backup, and accessibility/component tests.
- `e2e/`: Playwright desktop and mobile journeys.

Dependencies include strict TypeScript, React, Tailwind CSS, Lucide, Motion for React, Recharts, Dexie, Zod, date-fns, Radix Dialog, Vitest, Testing Library, and Playwright. DM Sans and Manrope are bundled locally, avoiding third-party font requests.

## Calculation model

All persisted financial amounts are safe integer paise. Input conversion separates the decimal digits directly instead of accumulating floating-point rupees.

For income `M`, recurring and one-time commitments `F + O`, actual calendar days `D`, and daily discretionary spending `E(d)`:

```text
monthly spendable = M - F - O
gross[d] = allocate(M, D)[d]
net[d] = allocate(M - F - O, D)[d]
allocated fixed[d] = gross[d] - net[d]
remaining[d] = net[d] - E(d)
cumulative unspent = sum(net[d] - E(d), for dates <= today)
monthly remaining = M - F - O - all recorded monthly spending
```

`allocate(T, D)` distributes `floor(abs(T)/D)` minor units to each date and one additional minor unit to the earliest `abs(T) % D` dates, then applies the original sign. The exact daily sum equals the monthly total. Gross-minus-fixed equals net on every day, including remainder boundaries. Negative totals are preserved. The paid flag is metadata and never enters the calculation.

Charts with daily unspent amounts and cumulative totals exclude future days. Future-dated manually entered expenses remain visible in complete monthly spending and the daily spending chart; they do not reduce unspent allocation for already elapsed days. Daily average uses elapsed calendar days, including zero-spending days. Monthly comparison notes explain that recorded totals can cover different elapsed periods.

## Storage and historical behavior

Database: `daywise-local-v1`, schema version 1. Tables: profiles, income revisions, recurring revisions, monthly plans, materialized monthly commitments, daily expenses, and custom categories.

Every financial table has a profile index, with compound month/date/source indexes where needed. A unique compound plan index prevents duplicate monthly plans. Month creation and commitment materialization occur in a single read/write transaction, so reopening a month or concurrent month reads do not create duplicate recurring charges.

Default changes are dated revisions rather than mutations to one timeless recurring record. Materialized months are snapshots. Explicit changes propagate from the selected month forward, preserving earlier months. Month-specific recurring amount overrides and explicit exclusions are marked and retained when an earlier default is updated. Changing payment status updates metadata only.

All local repository reads, exports, and deletes are scoped to profile ID. Updates reject existing records belonging to another profile. The provider only exposes month data if both the profile ID and year-month match the visible selection. Import ownership and collision checks execute in an atomic transaction. These controls separate local workspaces; they are not authentication or cloud authorization.

## Interface and accessibility

The visual system uses an off-white canvas, white cards, restrained violet accents, teal positive balances, amber nearing-limit states, and coral overspending. Dark mode uses graphite surfaces and softened accents. The sidebar collapses on desktop; mobile uses a six-item bottom navigation and touch-friendly forms. Charts resize with their container.

Dialog primitives provide focus containment, Escape dismissal, accessible titles, and focus restoration. Inputs have accessible names, errors use alerts, notifications use live status, calendar dates include spoken monetary breakdowns, and keyboard arrows move between dates. Focus indicators and a skip link are provided. Overspending has text as well as color. Animations respect reduced-motion preferences. A pre-paint theme script restores the previous appearance before hydration, followed by the selected profile's actual preference.

## Verification

Executed successfully on 22 October 2026 (Europe/Berlin), using Node 22.23.1, Next.js 16.4.2, React 19.3.1, Vitest 4.1.12, and Playwright 1.64.1 with installed Google Chrome.

| Check               | Final result                                             |
| ------------------- | -------------------------------------------------------- |
| `npm run lint`      | Passed; no errors or warnings                            |
| `npm run typecheck` | Passed; strict TypeScript                                |
| `npm test`          | 38 passed across 3 test files                            |
| `npm run test:e2e`  | 10 passed, 5 journeys each at desktop and mobile sizes   |
| `npm run build`     | Passed using Webpack; all application routes prerendered |

Financial/storage coverage includes all requested A–L cases: the exact 30-day example, 31-day remainder distribution, regular/leap/century February, zero income, negative budgets, recurrence history, transaction edits/deletes, profile isolation, month-specific data, exact signed allocation sums, no payment double deduction, and IndexedDB close/reopen persistence. Additional tests cover future expense exclusion from cumulative totals, concurrent month materialization, single-month recurring overrides/exclusions, pause/resume/end dates, one-time conversion, demo isolation, invalid date/amount rejection, backup round-trip, duplicate rejection, mixed-profile rejection, and cross-profile ID collisions. Component tests cover date labels, date/week keyboard focus, text-based overspending, and accessible Escape-dismissible dialogs.

The browser journeys exercise anonymous entry, named profile creation, onboarding income and recurring rent/custom commitments, calendar expense creation and editing, exact remaining balance, month navigation, search, per-profile theme, reload persistence, JSON download/restore confirmation, profile switching and isolation, malformed import rejection, one-time bill conversion, pause/resume, payment metadata without double deduction, repeat global searches, and actionable recovery when browser storage is blocked. Every main page is checked for horizontal overflow at desktop and iPhone 13 viewport sizes. The demo navigation test captured no uncaught browser errors.

An initial browser run found a select-label issue, which was fixed with explicit accessible names. A later test selector was narrowed to distinguish the application error toast from Next.js's route-announcer alert. Earlier interrupted/failed runs are not counted as final passes. Turbopack builds failed because the sandbox rejected an internal CSS compiler port; the configured, supported Webpack production build succeeded. Browser-restart persistence is covered by IndexedDB close/reopen plus page reload, rather than a separate automated operating-system/browser restart test. Safari and Firefox were not run; the mobile project uses Chromium emulation.

Screenshots generated from the real demo and visually inspected:

- [Desktop dashboard, light](screenshots/desktop-dashboard.png)
- [Desktop dashboard, dark](screenshots/desktop-dark.png)
- [Desktop calendar](screenshots/desktop-calendar.png)
- [Mobile dashboard, light](screenshots/mobile-dashboard.png)
- [Mobile dashboard, dark](screenshots/mobile-dark.png)
- [Mobile calendar](screenshots/mobile-calendar.png)

Full-page mobile captures include the fixed navigation at its viewport position. Exact calendar values remain available in accessible labels and day details; mobile cells use compact amounts for readability.

## Startup and configuration

```sh
cd /Users/likhithreddy/Documents/daywise
npm ci
npm run dev
# http://127.0.0.1:3000
```

No `.env` file is required. Production: `npm run build` followed by `npm start`. The build uses the supported Webpack bundler because Turbopack's internal CSS worker hit an execution-sandbox IPC restriction. Server scripts bind only to loopback. Automated browser tests currently use installed Google Chrome; instructions for bundled Chromium are in README.

## Remaining limits and future work

- Currency is INR only. The currency field is explicit and fixed; no foreign-exchange calculations or mixed-currency totals are implemented.
- Data belongs to a browser origin and device. Browser data deletion, private browsing, storage quotas, or device loss may remove it. Backup export is user initiated; automatic backup and cloud synchronization are future work.
- Local profiles are not secure user accounts, and the application is not ready for authenticated multi-user cloud use.
- Budget allocations and manually recorded transactions do not verify cash balances, bank payments, or actual salary receipts. No bank connection or investment advice is provided.
- Search/filter/export operates on the selected month. Monthly comparisons show saved plans only. No push reminders, email, background bank import, PWA service worker, or foreign currency support is included.
- End-of-month payment days are reminder metadata; there is no payment execution or automatic due-date notification.
- Schema version 1 establishes migration support. A real version-to-version migration needs to be authored when a version 2 schema is introduced.
- No deployment, push, or merge was performed.

## Supabase preparation

The pure financial engine and local repository interfaces provide a boundary for future authenticated adapters. [SUPABASE_INTEGRATION.md](SUPABASE_INTEGRATION.md) documents optional Auth/Google/email login, PostgreSQL tables, ownership policies and RLS testing, safe local-profile migration, and synchronization work. This branding update initializes no Supabase service and changes no existing connection details.
