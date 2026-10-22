# Supabase integration completion report

> Historical implementation evidence. The current release defaults to locked maintenance mode; see [DEPLOYMENT_REPORT.md](DEPLOYMENT_REPORT.md) for deployment preparation and current validation. Earlier test results below were not re-executed against a hosted backend for this task.

Date: 22 October 2026, Europe/Berlin. The application is branded Spendense; legacy technical identifiers remain compatible.

## Scope and delivered changes

Read `docs/SUPABASE_INTEGRATION.md` and `docs/IMPLEMENTATION_REPORT.md` in full, then audited the existing Stage 3 cloud implementation and local repository contracts. Reused its financial tables, forced RLS, transactional revision/materialization/import functions, and cloud adapter. Previously applied migration files 001/002 were preserved.

- Added email/password account creation and sign-in to the existing account dialog, including confirmation-required responses, validated email/password inputs, safe incorrect-credentials messages, password-manager autocomplete, and password changes. Existing email links provide recovery: sign in by email link, then change password in account controls. Existing optional Google entry remains available.
- Retained the configured `.env.local` URL/publishable key and canonical app-origin settings. No credentials were changed or copied into source/documentation.
- Kept the current cookie-based `@supabase/ssr` architecture, verified identity through `getClaims`/`getUser`, propagated SDK refresh cache headers and cookies, and retained private/no-store responses. Callback and identity endpoints recover from thrown provider/network failures without exposing codes or tokens.
- Added `202610220003_payment_state.sql` and switched `CloudRepository.markPaid` to its authorized, idempotent target-state RPC. Repeating an interrupted payment save no longer toggles the state back. Amounts and historical snapshots remain unchanged.
- Made automated browser configuration explicit: guest tests clear Supabase credentials; cloud tests accept only the local loopback stack and override the app origin. Hosted `.env.local` values cannot silently route these tests to production.
- Added real confirmed-email/password browser acceptance on desktop/mobile, covering cloud CRUD, recurring snapshots, exact paise, account separation, invalid-password rejection, and password changes. Added SSR cache/cookie regression tests and real-role SQL tests for idempotent payments and access denial.
- Updated integration architecture, README, historical implementation report context, and exact application instructions in `SUPABASE_SETUP.md`.

## Preserved data and behavior

`src/lib/finance.ts` has the same SHA-256 before and after work:

```text
490721d35f7232ca18baa03693b75234c91f4457ee8e78a88e69afeb93c9deb8
```

The IndexedDB schema/database, local adapter, local profile selection, integer-paise calculations, six finance routes, themes, and existing visual design are retained. No normal-browser local financial records were uploaded or deleted. Signing up/in creates no cloud financial profile automatically. Existing consented imports still require review, a downloaded backup, and explicit account-specific consent, then create a separate cloud workspace with transactional verification and retry receipts. Local originals remain available.

All nine exposed tables force RLS and reject anonymous financial access. Owner-qualified foreign keys and immutable identity checks prevent cross-account parent references and ownership reassignment. All application RPCs retain caller permissions and empty search paths. The app uses no elevated Supabase client.

## Verification

This run used the existing local Supabase Docker volumes without resetting them. Applied only migration 003 with `supabase migration up --local`, then restarted local services with confirmation enabled. SQL test records were synthetic and rolled back; browser tests used isolated Chrome storage and synthetic local-only accounts. The task's local services were stopped after verification with their database volumes preserved. No remote project was linked, migrated, or deployed.

| Check | Executed result |
| --- | --- |
| `npm run lint` | Passed; no errors/warnings |
| `npm run typecheck` | Passed; Next type generation and strict TypeScript |
| `npm test` | Passed; 66 tests across 6 files |
| `npm run build` | Passed; Next.js 16.4.2 production Webpack build |
| `npm run db:test` | Passed; 131 pgTAP assertions across 3 suites |
| `npm run test:e2e` | Passed; 23 passed, 5 intentional configuration/project skips |
| `npm run test:cloud` | Passed; 25 passed, 3 intentional configuration/project skips in the final complete run |
| `npm audit --omit=dev` | Passed; zero production dependency vulnerabilities |

Guest skips are the four cloud-only desktop/mobile cases and the desktop duplicate of the narrow-screen-only check. Cloud skips are the two unconfigured-installation cases and that desktop narrow-screen duplicate. Skips are not counted as passes.

The database tests cover every exposed table's RLS, forbidden anonymous operations, forged ownership, cross-account reads/updates/deletes, parent references, unauthorized RPCs, history preservation, month materialization, recurring override/exclusion/pause/conversion, exact import manifests, rollback, and retry receipts. New payment tests cover repeated true/false saves, null/missing records, second-account denial, anonymous denial, and SECURITY INVOKER.

The earlier Stage 3 browser journey additionally tests backup/consent gating, retained local data, exact imported/exported collection totals, unchanged retries, independent browser/device access, full browser-process restart persistence, expired-token refresh, invalid-session recovery, network retry, and malicious authenticated/anonymous API requests. The new browser journey exercises confirmed-email/password flows and financial persistence through the actual application.

An initial cloud run exposed a password-field accessible-name issue caused by its inline help text. The field now has an explicit accessible name with a separate description. A new test's post-logout assertion also needed to navigate from Settings to Dashboard before checking the retained guest budget. Both desktop/mobile password journeys subsequently passed. Initial failures are not reported as final passes.

## Applying SQL and production status

The complete ordered migration set is in `supabase/migrations/`: schema 001, transactional operations 002, and payment state 003. Follow `SUPABASE_SETUP.md` for CLI login, linking the explicitly selected staging project, migration history, dry-run review, approved application, RLS verification, and separate production approval. Existing installations with 001/002 recorded apply only 003. The app release requires 003 before cloud payment saves are enabled.

This checkout has no `.git` directory, so no Git commit was created. The numbered SQL artifacts and tests are ready to include in the user's normal version-control workflow.

Implementation and local verification do not activate or certify the hosted environment. Production database changes and deployment require explicit approval. Hosted email delivery, provider settings, canonical HTTPS callbacks, deployed caching/session behavior, and staging two-account acceptance remain environment-specific checks. Existing cloud limits remain: connectivity is required, no offline write queue or history merge, same-record edits follow the last successful write, and very large whole-profile exports/imports require further scaling work.
