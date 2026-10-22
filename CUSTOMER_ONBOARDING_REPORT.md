# Spendense — Customer onboarding and UI refinement

## Delivery

Implemented incrementally on **UI-upgrade** from `396c031410dc726ce69c77aebfc9172e6d5ff5b4`. Implementation commit: `8e34e5ef93df5e4875255ff06ad5148b7b731a4a`. This report is delivered in the following documentation commit. No main-branch edits, merges, production deployment commands, remote migrations, environment-variable changes, or hosted staging projects were performed.

Reviewed `AGENTS.md`, the installed Next.js 16.4.2 component/CSS/authentication guides, the prior UI report, existing identity/finance/repository code, migrations, unit/E2E suites and screenshots before implementation.

## Changes and UI review

The daily hero now contains only the verified customer's complete Auth display name, with **Available today** below the name (or **Average daily allowance** for another month). Date, exact allowance, spending, remaining allocation and detail action use the original calculations. Guests show their explicit preferred name or Guest; demo shows Demo. Budget names never substitute for authenticated identity.

Removed repeated Personal finance labels from the welcome header, sidebar and breadcrumb, the decorative welcome pill and repeated footer wording. Removed a repeated income amount above the allocation distribution. Monthly Overview moves secondary calculation explanations into a keyboard-accessible disclosure. The allocation-versus-bank-balance explanation remains available. Calendar, transactions, charts, monthly plans, expense forms and the premium theme system are retained.

New setup fields, category cards, labels and explanations use 14–16px normal text, 24–30px headings, generous spacing and 44–48px controls. The existing DM Sans/Manrope, violet, lavender, subtle borders and light/dark surface tokens are reused. New CSS belongs to the new components; this is not another page-wide override layer. Visual review corrected compressed heading letter spacing and verified actual dark-theme application before screenshots.

Before screenshots were captured locally at 1440px and 390px before changing existing UI. The public production welcome page was also viewed read-only in an isolated browser; it still showed the earlier compact interface and was not treated as the branch implementation. No production financial account was opened.

## Onboarding journey

Registered cloud customers without a valid saved preferences row receive four short forms followed by a concise completion notification/dashboard transition:

1. **Tell us about yourself:** prefilled full name, read-only verified account email, optional preferred name. Full name is required; optional phone/country fields were omitted because this feature does not need them.
2. **How do you earn?:** accessible selectable cards for salaried, self-employed/freelancer, business, and other/variable income.
3. **Income details:** only relevant fields. Salaried customers can add employer/title and monthly, weekly or daily compensation. Freelancers can leave company blank and record variable income/notes. Business customers can supply revenue/costs/industry and confirm their separate monthly personal take-home.
4. **Set up your budget:** selected current/future month, existing allocation, estimate, optional confirmed amount, scope, existing commitments and daily preview. The original commitment form adds recurring expenses, without seeding/duplicating any bills. Applying income is explicitly opt-in; keeping the existing allocation is the default.
5. **Completion:** saved server-side, then the dashboard opens. Reload and repeat login do not repeat valid completed setup. A legacy account completes missing details once while retaining its budgets and history.

**Personal & Income Details** in Settings displays full name, verified email, employment category, organization, frequency, personal rate, monthly estimate and completion status. The same forms edit these details. Name editing is consolidated here for registered accounts; guest preferred-name editing remains in Guest Mode. Preference-only edits neither create a budget nor write income. Existing income controls remain available for later revisions and overrides.

## Income calculation policy

`src/lib/finance.ts` is unchanged. Existing integer-paise allocation, monthly defaults/overrides, calendar/day calculations, paid commitments and bank-balance distinctions remain authoritative.

| Input | Monthly starting estimate |
| --- | --- |
| Monthly | Exact rate in integer paise |
| Weekly | `(BigInt(rateMinor) * 52 + 6) / 12`, integer division: nearest paise, half up; clearly labeled annualized estimate, not actual cash received |
| Daily | Rate × count of explicitly selected paid weekdays in the chosen real calendar month; 28/29/30/31 days and leap years tested |
| Freelancer/variable | Same explicit frequency policy, with review and month-specific overrides |
| Business | Confirmed personal take-home only; revenue and operating costs are context and never deducted again |

Inputs and resulting estimates are bounded to the existing supported amount. Daily schedules reject duplicates/out-of-range weekdays and empty paid schedules. Holidays and unpaid leave are explicitly not deducted automatically. The daily preview is an average; existing allocation logic distributes exact paise across individual dates.

The completion response also updates the selected budget’s confirmed completion flag in memory before rendering the dashboard, preventing the older per-budget wizard from flashing. A browser mutation-observer regression check covers this transition.

No preference edit automatically rewrites monthly plans. Applying a reviewed amount calls the original income operation within the completion transaction. The customer explicitly chooses one monthly override or a constant default from the selected month onward; future explicit overrides stay intact. Past months cannot be changed by the new save RPC. Choosing a default does not schedule automatic salary recalculation each month.

## Persistence, ownership and reliability

Full name and optional preferred name use the existing Supabase Auth metadata mechanism. Identity reads still use verified server `auth.getUser()`. Names remain display metadata; authorization always uses the verified user UUID. Detailed employment/rates/revenue/costs are **not** stored in Auth metadata or financial `profiles`.

The additive migration [`supabase/migrations/202610230001_customer_preferences.sql`](supabase/migrations/202610230001_customer_preferences.sql) creates an Auth-user-owned preferences table with a primary key per owner, completion timestamp, revision, last request UUID, JSON/amount/schedule constraints, forced RLS, four owner-only CRUD policies and authenticated-only grants. Existing financial tables, profile IDs, foreign keys and policies are unchanged.

The new security-invoker save RPC uses the caller's RLS permissions, a per-customer transaction lock, revision checks and a compare-and-set of the reviewed income/override. A repeated successful request returns the saved result without repeating an income write. Saving optional confirmed income, completion and preferences is atomic. A failed transaction leaves financial values/completion unchanged. Auth name updates use the existing separate Auth operation and may succeed before a preferences error; retry remains safe.

The provider keys state by verified account/mode, cancels stale loads, prevents an in-flight read from undoing a successful save and keeps name/token refresh from restarting the wizard. Uncertain authentication still blocks financial views with retry. Missing migration/connectivity errors are explicit; existing budgets stay accessible and no guest identity is fabricated.

## Compatibility and data separation

Existing owned budgets are reused; deterministic initial creation remains idempotent. Multiple legitimate budgets stay available through Manage Budgets, and profile switching stays account scoped. No records are merged, renamed or deleted automatically.

Guest/demo IndexedDB data and compatibility keys are unchanged. Guests retain the existing short budget setup without employment questions. Guest data is never uploaded by login/onboarding. The backup/review/consent/verification import flow remains separate. Sign-out/account switching still clears authenticated in-memory records and preserves local data.

## Files changed

- Customer UI: `src/components/customer-onboarding.tsx`; integration/cleanup in `shell.tsx`, `dashboard.tsx`, `account.tsx`, `settings.tsx`, `budget-breakdown.tsx`, `provider.tsx`, and `src/app/globals.css`.
- Auth metadata: `src/lib/auth.ts`, `src/lib/identity.ts`, `src/app/api/auth/route.ts`.
- New normalization/persistence: `src/lib/customer-income.ts`, `src/lib/repositories/customer.ts`.
- Additive SQL and local database tests; new normalization/repository unit tests; onboarding/browser helper coverage and affected existing E2E updates (including chunked Auth-cookie fixture support).
- Capture script, screenshots, this report and the operator rollout guide.

The original local/cloud budget repositories, account migration and finance engine are unchanged. `next-env.d.ts` was already modified when this task began and is generated again by Next.js checks; it is excluded from the feature commits. Older screenshots regenerated by existing tests are restored; the new phase evidence stays in its own folder.

## Validation evidence

Final command results are recorded below. Logs are copied into `docs/validation/customer-onboarding/` with synthetic fixture emails only; no credentials/session cookies are included.

| Check | Result |
| --- | --- |
| `npm run check:secrets` | PASS: credential scan |
| `npm run lint` | PASS: no warnings/errors |
| `npm run typecheck` | PASS: Next type generation and TypeScript |
| `npm test` | PASS: 115 tests, 11 files |
| `npm run build` | PASS: optimized Next.js build |
| `npm run db:test` | PASS: 157 checks; rolled-back local fixtures |
| `npm run test:e2e` | PASS: 27 tests; 9 expected configuration/project skips |
| `npm run test:cloud` | PASS: 33 tests; 3 expected configuration/project skips |
| `npm run test:deployment` | PASS: 2 maintenance + 2 local locked-mode tests; 2 additional compiled-maintenance tests |
| Responsive capture | PASS: 35 route/theme layouts; zero horizontal overflows |

Configuration-specific skips are deliberate: cloud-required cases run in the local cloud suite, the missing-configuration guest case runs in the guest suite, and the narrow-mobile-only case runs in the mobile project. No required suite was unavailable. Initial harness issues (chunked cookies and an interrupted development reload) were corrected/rechecked; the production-mode lock check uses a bundle compiled with the corresponding local maintenance setting.

New automated coverage includes monthly/weekly/daily conversions, leap-year paid schedules, variable freelance and business take-home, signed-up names, first-login missing-name completion, conditional forms, once-only completion, failure/retry, preference-only edits, unchanged history, owner-only reads/writes and no duplicate budgets. Existing full finance, backup/import, authentication, session refresh and cross-account suites remain in use.

Visual evidence is in [`docs/screenshots/customer-onboarding`](docs/screenshots/customer-onboarding). Five-width category screenshots and 35 route/theme checks complement desktop/mobile customer setup, business/daily fields, account details, authenticated dashboards, demo light/dark and before screenshots. Captures use isolated local fixtures, never real financial records. Keyboard typing/focus, native radio/weekday controls, labeled fields, dialog behavior, dark/light layouts and responsive truncation are checked. The eight primary text/surface/button token pairs used by the new forms measure 5.51:1–14.57:1 contrast (all above AA normal-text contrast); exact pairs are recorded in `contrast.json`. This is targeted visual/accessibility validation, not a claim of a complete independent WCAG audit.

Reproduce demo captures using a local server with empty Supabase credentials: `NEXT_PUBLIC_APP_MODE=live NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run dev -- --port 3300`, followed by `node scripts/capture-customer-ui.mjs`. Authenticated setup captures come from `npm run test:cloud -- e2e/customer-onboarding.spec.ts` against the disposable local stack.

## Limitations and hosted rollout

Only local Supabase behavior has been validated. Hosted Auth providers, outbound email and the hosted migration are not tested or applied. Daily paid-day estimates do not model holidays/leave, and weekly amounts are annualized estimates. Preferred name is optional stored metadata; the daily hero intentionally always uses the complete full name as requested. No automated future-income scheduler is introduced. Customer-level preferences are not included in the existing per-budget JSON backups; those backups and restore semantics continue to cover the original financial records.

The schema must be reviewed/applied to the **existing** hosted project by an authorized operator before releasing the feature. Exact prerequisites, SQL path, ordering, grants/RLS checks, synthetic two-account smoke tests and non-destructive rollback guidance are in [`docs/CUSTOMER_ONBOARDING_ROLLOUT.md`](docs/CUSTOMER_ONBOARDING_ROLLOUT.md). No new variables or provider configuration are required. This task does not authorize or execute that hosted rollout, deploy to production, change Vercel's Production Branch, merge into main or create a hosted staging database.
