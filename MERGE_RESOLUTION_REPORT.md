# PR #2 merge resolution and release review

Date: 2026-10-23. Repository: VLR-Technologies/spendense. Delivery branch: `UI-upgrade`.

## Outcome and scope

Merged `origin/main` (`f120a0c619982bc0da47c4cc2b29ae44f5427948`) into `UI-upgrade`, starting from `8e2fe3ae9576622a1b9706e400bd12fb5dbece53`. The working tree was clean before fetching and merging. Both branch histories are preserved. There was no reset, force push, main-branch write, hosted database operation, deployment command, or domain/configuration change.

The branches contained equivalent earlier UI and customer-onboarding implementations under different commit IDs. Comparing their actual files showed the financial engine, local/cloud repositories, import logic, workspace provider, and all four migrations were identical. The later landing/OAuth fixes existed only on `UI-upgrade`. This explains why several resolved files have no content delta against the source parent even though Git required conflict resolution. See [source-review.json](docs/validation/merge-resolution/source-review.json) for both input revisions and the reviewed file blobs.

## Conflict decisions

Both sides of all nine conflicts were inspected, together with the automatically merged authentication and account controls.

| File | Resolution |
| --- | --- |
| `src/components/shell.tsx` | Keep the latest three-action landing page and sample Daily Budget card. Keep the repeat-entry guard, explicit guest budget reuse, authenticated budget reuse, and customer-onboarding gate. Do not restore the removed demo action or its boolean handler. |
| `e2e/daywise.spec.ts` | Keep all finance/commitment scenarios; seed synthetic demo records with the existing local-only fixture. |
| `e2e/email-password.spec.ts` | Keep confirmation, financial history, recovery, and two-account isolation coverage; replace removed demo-button setup with the fixture. |
| `e2e/stage-2.spec.ts` | Keep historical finance coverage and fixture setup; wait for the current guest CTA when opening legacy local records. |
| `e2e/stage-3.spec.ts` | Preserve guest/configuration errors, callback errors, explicit import consent/backup/verification, refresh and cross-device isolation coverage. Use the fixture rather than a removed landing action. |
| `e2e/ui-upgrade.spec.ts` | Keep name, identity, guest idempotency and responsive/theme checks. Assert no demo CTA and preserve the preview-card assertion. |
| `scripts/capture-customer-ui.mjs` | Keep capture workflow and customer screens; wait for the guest CTA and use the local fixture. |
| `scripts/capture-ui.mjs` | Keep responsive screenshot workflow and use the fixture. |
| `src/tests/auth.test.ts` | Preserve verified-name metadata coverage from main and additional cancellation, canonical callback, sanitized error and direct-dashboard tests from UI-upgrade. Equivalent mock formatting was normalized. |

The fixture refuses non-loopback hosts, does not clear browser databases, and contains synthetic records. Existing demo infrastructure remains available elsewhere.

Additional regression coverage in `e2e/customer-onboarding.spec.ts` simulates missing table/RPC API responses without changing database schemas. It verifies an existing authenticated budget remains readable, income/expense records remain unchanged, failed setup creates no preferences or duplicate budget, and retry succeeds when service availability returns. Unit tests in `src/tests/customer-income.test.ts` also cover PostgREST missing-table and missing-RPC codes.

## Preserved functionality

- Sign in, Create account and Continue as guest remain usable; Try demo is absent from the landing page and the illustrative budget is retained.
- Google uses Supabase `provider: "google"` and PKCE. Provider availability, SDK/network failures and cancelled/expired callbacks produce recoverable messages. Provider details are not echoed into the UI. Successful verified code exchange redirects directly to the dashboard.
- Email/password, confirmation, email links, recovery and cookie-backed session refresh remain intact. Local integration tests use actual local Supabase Auth and local email delivery.
- Supabase remains the registered identity authority. Customer metadata, legacy-name fallback, one-time onboarding, preferences edits and authorized multiple budgets remain supported.
- Integer-paise finance code, historical revisions, recurring commitments, paid state, guest IndexedDB compatibility keys, exports/restores and explicit local-to-cloud imports are unchanged by this merge.
- Authentication failures do not silently fall back to a guest identity. Sign-out/account switching unmounts previous financial state; owner protections remain enforced.

## Customer migration dependency and rollout order

Reviewed the complete `supabase/migrations/202610230001_customer_preferences.sql`, its repository/provider/UI callers, and database tests. It adds one owner-scoped preferences row per Auth user, validation constraints/trigger, forced owner RLS and the authenticated, SECURITY INVOKER `spendense_save_customer` RPC. There is no backfill, automatic income rewrite, existing financial-policy change or schema edit introduced by this resolution.

Dependencies are `202610220001_schema.sql` (financial domains, tables, owner identity) and `202610220002_operations.sql` (`daywise_lock`, `daywise_ensure_month`, `daywise_income`). Preserve `202610220003_payment_state.sql` in the normal migration sequence as well; the new RPC does not directly depend on it.

Local validation replayed all four exact migration files into a fresh temporary database inside the local Supabase PostgreSQL container. That fixture used a minimal `auth.users` table and the actual local `auth.uid()` function. A synthetic legacy budget, income and leap-day expense were created before applying the customer migration. All exported record fields were identical afterward, excluding only the deliberately changing `exportedAt` timestamp. All 157 pgTAP assertions then passed on that fresh schema. Only the newly created temporary database was removed. The full existing local Supabase stack separately passed its 157 database assertions. See [migration-replay.txt](docs/validation/merge-resolution/migration-replay.txt) and [db.txt](docs/validation/merge-resolution/db.txt).

**Releasing the application before this migration produces runtime API errors for the missing table/RPC and prevents customer-preferences setup or saves.** Those errors are handled: the tested existing-budget scenario shows an actionable service-update warning while retaining authenticated access and unchanged financial records. It does not crash or become a guest. This graceful fallback is not full feature availability and is not a reason to reverse the rollout order.

Required operator order, after separate authorization:

1. Inspect the existing hosted project's migration history and prerequisite function signatures; arrange its normal backup/recovery point. Hosted history was not inspected or changed here.
2. If the prerequisites are already installed, apply only the exact pending `202610230001_customer_preferences.sql` once and record its migration version. Reconcile any prerequisite mismatch before proceeding; do not replay historical migrations or reset data.
3. Verify grants, owner isolation, constraints and RPC behavior using dedicated operator test accounts.
4. Resolve the OAuth origin configuration below and complete the live authentication smoke test.
5. Release the reviewed application through the separately authorized process. If rolling back the application, retain the additive preferences table and its records.

The existing [customer rollout guide](docs/CUSTOMER_ONBOARDING_ROLLOUT.md) contains the detailed handoff. No remote schema changes were performed.

## Production domain and Google OAuth

**Authorized follow-up on UI-upgrade, 2026-10-23:** `src/lib/auth-redirect.ts` and its tests now select `https://www.spendense.com` for production OAuth initiation, successful callbacks and error redirects from either production alias. This resolves the application-code mismatch identified at merge commit `10261b6` below. No Vercel, Supabase or Google Cloud setting was changed. Confirm the hosted Site URL/allowlist and complete the live Google smoke test before release. Current configuration guidance is in [LANDING_OAUTH_REPORT.md](LANDING_OAUTH_REPORT.md).

Read-only HTTP checks on 2026-10-23 confirmed **308 redirects** from `https://spendense.com/` to `https://www.spendense.com/`, and from the apex `/auth/callback` to the corresponding `www` callback. At merge commit `10261b6`, `src/lib/auth-redirect.ts` selected **`https://spendense.com`** for both production aliases, including the post-exchange dashboard redirect. Changing `NEXT_PUBLIC_APP_URL` alone could not reconcile that hardcoded mapping.

The safest consistent configuration preserves the current Vercel **`www.spendense.com` primary domain** and aligns the application OAuth callback/dashboard origin, Supabase Site URL and redirect allowlist to it. The authorized follow-up implements that application-code adjustment. The merge itself preserved the earlier branch policy and made no production domain change. Merely adding both aliases to the allowlist does not establish one consistent origin.

Under the current redirects, the browser may return through `www` before the callback runs; therefore this review does **not** claim that every login necessarily fails today. It does identify unnecessary cross-origin redirects and a cookie/PKCE dependency on that redirect topology. PKCE stores a verifier in a cookie and the callback needs it; session cookies must also reach the dashboard. See the official [Supabase Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google) and [server-side cookie guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

If apex is preferred later, obtain explicit approval for a coordinated primary-domain, callback, Site URL and allowlist change. Account for origin-scoped guest IndexedDB and backups before redirecting existing `www` guests to a different storage origin. Do not add an opposing application redirect while Vercel redirects apex to `www`.

The hosted public Auth settings now report **Google enabled**, observed at the timestamp in [production-observation.json](docs/validation/merge-resolution/production-observation.json). Earlier reports recording a disabled provider are historical. No Google credentials were read, stored, changed or printed. Enabled status does not prove valid client credentials or a completed sign-in.

Manual release checks remain: verify Google Cloud's authorized redirect URI is the existing Supabase project's `/auth/v1/callback` (distinct from the application's `/auth/callback`); check the approved application origin/Supabase allowlist; and use an operator-controlled Google account to verify consent, callback, direct dashboard access, refresh/navigation persistence, cancellation and sign-out. No successful hosted Google authentication is claimed from mocked/unit tests or SDK initiation checks.

## Validation

Fresh checks were run against the merged tree. Full results and command output are in [docs/validation/merge-resolution](docs/validation/merge-resolution).

| Check | Result |
| --- | --- |
| `npm run check:secrets` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 131 tests in 12 files |
| `npm run build` | PASS, production build |
| `npm run db:test` | PASS, 157 assertions in 4 suites |
| Fresh local migration replay | PASS, all 4 migrations, preserved synthetic financial history, 157 assertions |
| `npm run test:cloud` | PASS, 42 passed / 4 expected skips, desktop and mobile |
| `npm run test:e2e` | PASS, 30 passed / 16 expected skips, guest-only configuration |
| `npm run test:deployment` | PASS, 2 desktop/mobile maintenance-boundary tests |
| Conflict markers and unmerged index entries | PASS, none |

The four cloud skips are the missing-configuration test in both projects and two alternate viewport variants whose matrix is exercised in the other project. Guest-only mode additionally skips 14 scenarios requiring configured local Supabase; those scenarios ran in the cloud suite. No skipped scenario is presented as a completed live Google sign-in.

The first focused cloud run passed 21 scenarios and failed the two instances of the new compatibility test because an unscoped alert locator also matched Next.js's route announcer. The locator was corrected; application code was unaffected. The initial result is retained in `cloud-initial.txt`, and the final full run is recorded separately. The temporary migration-check harness was also corrected to add a SQL separator and ignore the volatile export timestamp before its successful replay.

Desktop/mobile landing and authenticated-dashboard screenshots were visually inspected. Automated tests check the 1440, 1024, 768, 390 and 360px layouts, large amounts and light/dark themes. Existing tracked historical screenshots are retained. Fresh synthetic screenshots: [desktop landing](docs/validation/merge-resolution/screenshots/desktop-landing.png), [mobile landing](docs/validation/merge-resolution/screenshots/mobile-landing.png), [desktop dashboard](docs/validation/merge-resolution/screenshots/desktop-customer-dashboard.png), and [mobile dashboard](docs/validation/merge-resolution/screenshots/mobile-customer-dashboard.png).

## Delivery and readiness

All requested local gates pass. This report and its evidence accompany the merge-resolution commit on `UI-upgrade`; its two input commit IDs are recorded above. The delivery message records the resulting commit SHA and the GitHub mergeability check after pushing this branch to [PR #2](https://github.com/VLR-Technologies/spendense/pull/2).

The resolution is ready for integration review. PR #2 remains open and is not merged automatically. Production release still requires the separately authorized migration, a consistent OAuth origin and a successful hosted Google smoke test. No production deployment, remote migration or primary-domain change is authorized or performed by this delivery.
