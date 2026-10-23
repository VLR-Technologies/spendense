# Spendense — Landing cleanup and Google OAuth validation

Branch: **UI-upgrade**. Base: `583d027e9107ff13003392ac73c2ad22ce24e4cc`.

## Outcome and live findings

The landing-page **Try demo** action is removed. Sign in, Create account, Continue as guest and the illustrative Daily Budget card are preserved. The demo-only landing branch/parameter is removed; shared button/layout styling and the preview's arrow remain useful and are retained. Existing demo storage, reset, backup/import, budget switching and finance logic are unchanged.

**Successful production Google sign-in has not been verified.** A read-only isolated production-browser check on 2026-10-23 found:

- `https://spendense.com` redirects to `https://www.spendense.com`.
- The currently deployed Google action sends `provider=google` and `redirect_to=https://www.spendense.com/auth/callback`.
- Supabase rejects it because the Google provider is not enabled, showing its raw error response in the old deployed flow.

No Google credentials were entered, no account was authenticated, and no hosted configuration/database/deployment changes were made. These observations describe the deployed application before this patch, not the new local build. Evidence: `docs/validation/landing-oauth/live-observation.json`.

## Authentication implementation

- `src/lib/auth.ts` still invokes Supabase `signInWithOAuth({provider: "google", options: {redirectTo}})`. Google Client ID/Secret remain exclusively in Supabase's provider configuration.
- `src/lib/auth-redirect.ts` maps both known production aliases to **`https://spendense.com/auth/callback`**, and successful production callbacks to **`https://spendense.com/dashboard`**. A stale localhost/cross-origin app setting cannot override a known production host. Local development retains its actual origin for host-only PKCE cookies; there is no hardcoded localhost production redirect.
- `src/lib/google-provider.ts` reads Supabase's public `/auth/v1/settings` capability endpoint, using only the existing browser-safe public API key, before starting Google OAuth. A disabled provider or unavailable/malformed response produces a concise in-app error with email/guest alternatives, rather than navigating to the known disabled-provider JSON page. Provider flags are checked at click time and not cached indefinitely.
- `src/app/auth/callback/route.ts` rejects provider cancellation/errors before exchange, exchanges a valid authorization code through the existing server client, verifies claims, and redirects directly to `/dashboard`. It does not create budgets or perform a second login. Server-client/network/exchange/verification failures return only a generic `auth_error=callback`; codes and provider descriptions are not reflected in redirect destinations.
- `src/components/account.tsx` explains cancellation, expiry and verification failures without raw JSON. Existing email/password, confirmation, email-link and guest actions retain their behavior.

The browser/server clients and session Proxy were inspected and retained: `@supabase/ssr` supplies PKCE, persistence and automatic refresh; server cookies are written through the Route Handler cookie store; Proxy refreshes verified claims and forwards refreshed request/response cookies and private no-store headers. SameSite=Lax and production Secure cookies remain unchanged. Registered identity still comes from verified server Auth state. Existing first-time customer onboarding may appear within `/dashboard`; it is not a second authentication request.

The code does not add automatic profile creation, change financial repositories, or alter import consent. Existing integration tests exercise repeated login, profile reuse, cross-account isolation and expense persistence.

## Manual configuration still required

The operator must complete these steps in the **existing** project; no second Supabase project or staging environment is needed:

1. In Google Cloud, use a Web application OAuth client. Set the authorized JavaScript origin to `https://spendense.com`. Use the Supabase callback URI shown in the existing project's Google-provider page as Google's authorized redirect URI: currently `https://cafchbayuygxiummapyf.supabase.co/auth/v1/callback`. This differs from the application callback.
2. In Supabase Dashboard → Authentication → Providers → Google, manually enter the Client ID and Client Secret and enable Google. Do not put either value in application source, public environment variables or this report.
3. In Supabase URL Configuration, confirm Site URL `https://spendense.com` and allow the exact application callback `https://spendense.com/auth/callback`. Review any existing `NEXT_PUBLIC_APP_URL` setting for the same canonical origin. This task has not changed those settings.
4. Resolve the observed apex-to-www hosting redirect before claiming canonical-domain support. The intended serving/redirect arrangement must keep the OAuth start, verifier cookie, callback and dashboard on the apex host. No opposing app-level alias redirect was added, which would risk a redirect loop with the current hosting rule. Domain changes need operator review: browser-local guest records are origin-specific, so retain an export/recovery path for existing www guest budgets before changing their access origin. This patch neither moves nor deletes those records.
5. After an authorized release/configuration change, perform the live checks below. Provider enabled flags alone do not prove correct Google credentials, consent configuration or session persistence.

These setup details follow [Supabase Google authentication](https://supabase.com/docs/guides/auth/social-login/auth-google). Cookie verification/refresh behavior follows the [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client). Public capability shape is documented in the [Supabase Auth settings implementation](https://github.com/supabase/auth/blob/master/internal/api/settings.go).

## Live browser checks pending configuration

Use a dedicated operator-controlled account, without editing real financial records:

- Start at the apex URL; confirm it remains the canonical host. Continue with Google, choose an account and complete consent.
- Confirm the app callback exchanges the code and opens `/dashboard` with the verified customer identity, without a second sign-in. A new customer may need the existing once-only customer setup.
- Refresh and navigate between Dashboard, Calendar and Settings; identity and existing owned expense history must persist. Sign out and sign in again; confirm no duplicate application budgets.
- Cancel consent and try an expired callback; confirm a clear recovery message, no provider JSON/tokens and usable email/guest controls.
- Verify existing email/password login and guest access. Confirm local guest records remain separate and no automatic cloud import occurs.

The initiation-only browser test mocks the provider-enabled flag and intercepts authorization navigation. It validates the actual SDK's provider, PKCE challenge and callback parameters, **not successful Google authentication**. Real local email PKCE/session integration tests exercise the shared code exchange and persistence mechanism but do not substitute for a live Google check.

## Changed files and test infrastructure

Product: `src/components/shell.tsx`, `src/components/account.tsx`, `src/lib/auth.ts`, new `auth-redirect.ts` / `google-provider.ts`, and `src/app/auth/callback/route.ts`.

Validation: focused unit/callback/provider tests; new `e2e/landing-oauth.spec.ts`; affected existing E2Es now load an isolated static demo fixture instead of a removed UI action. `e2e/fixtures/demo.json` was generated using the unchanged local demo repository with an isolated in-memory IndexedDB and a fixed test clock. `scripts/lib/demo-fixture.cjs` refuses non-local hosts, never clears storage, and is used only by QA scripts/tests; it adds no production demo route or hidden UI action. Screenshot helpers and README now match the cleaned landing page.

No financial calculation, repository, RLS policy, database schema, migration or storage key was changed. No migration was applied. The pre-existing generated `next-env.d.ts` edit is excluded from this feature. Existing historical screenshots regenerated by tests are restored; new landing evidence stays under `docs/screenshots/landing-oauth/`.

## Verification

Reviewed AGENTS.md, installed Next.js Route Handler/Proxy documentation, auth clients, session provider, callback, account modal and existing tests before editing.

| Check | Result |
| --- | --- |
| Secrets scan | PASS |
| Lint | PASS: no warnings/errors |
| Type check | PASS |
| Unit tests | PASS: 129 tests |
| Production build | PASS |
| Focused desktop browser tests | PASS: 5 tests (including real local email login/session persistence) |
| Full local cloud E2E suite | PASS: 40 tests; 4 expected configuration/project skips |
| Guest E2E suite | PASS: 30 tests; 14 expected configuration/project skips |
| Deployment boundary tests | PASS: 2 tests |
| Landing responsive/visual checks | PASS: 1440, 1024, 768, 390 and 360px, light/dark, all three CTAs ≥44px, no horizontal overflow |
| Production Google end-to-end | NOT VERIFIED: provider disabled; canonical hosting alignment/manual configuration pending |

Configuration-specific skips are deliberate: cloud-only tests run in the local cloud suite, missing-configuration tests run in the guest suite, and the complete landing width matrix runs once in the desktop project. No required local suite was unavailable.

Final successful logs are retained under `docs/validation/landing-oauth/`. No database migrations, remote schema writes, production deployment, main-branch push, or credential configuration was performed.
