# Spendense storage and authentication

The deployment boundary in `src/lib/deployment.ts` defaults to maintenance. `maintenance` and `staging` mount a holding page before workspace hooks, IndexedDB, or auth subscriptions. Both repository adapters reject financial access; client factories, Proxy session refresh, and auth routes also enforce the lock. Only `NEXT_PUBLIC_APP_MODE=live` restores the application described below. Public configuration is fixed at build time, so changes require a new build. See [deployment evidence and activation checklist](../DEPLOYMENT_REPORT.md).

The six finance routes share `AppProvider`. `src/lib/finance.ts` remains the authoritative pure paise calculation engine, including signed exact allocation over 28/29/30/31 days. Payment status changes metadata, never an amount or a second expense.

## Guest storage

`LocalRepository` uses the existing Dexie database `daywise-local-v1`, version 1. No database upgrade, reset, sync queue, or data deletion is introduced. Guest profile selection remains `daywise-profile`; preferences remain local. Guest CRUD, backups, demo data, historical overrides, and named profiles work without Supabase configuration. Guest finance operations require no network; loading an app shell for the very first time still requires the app server. This release does not add a service worker or guarantee cold-start offline page navigation.

## Cloud storage

`DaywiseRepository` extends the original contracts with payment, removal, categories, and profile lifecycle operations. UI code obtains the selected repository from context. Forms, settings, categories, and insights do not use the Supabase SDK or query IndexedDB directly.

`CloudRepository` translates Postgres timestamps and nullable fields into the existing domain shapes. Ordinary expense/category/profile operations use the publishable-key client with the user's access token. Atomic RPCs handle month materialization, income revision propagation, recurring changes, payment toggling, removal, export, and import. Money is PostgreSQL BIGINT limited to the existing per-record range; JS validation rejects unsafe aggregate totals. No budgets are calculated in SQL. Read exports currently load a whole profile, which prioritizes coherent migration/history over large-data scalability.

Cloud writes require a network. Failed writes show retry guidance; no changes are silently queued. Focus/online events reload saved data. Other devices see saved changes on navigation, reload, or focus; this is not a realtime collaboration or conflict resolution system. A per-workspace row lock serializes compound app operations. Concurrent edits of the same record remain last successful write wins; there is no version conflict dialog. Payment toggles should be reloaded before a manual retry if an HTTP response was lost.

## Authentication

`src/lib/supabase/browser.ts` and `server.ts` use `@supabase/ssr`. Next.js 16 `src/proxy.ts` refreshes using `getClaims()` and forwards refreshed request/response cookies. Auth responses are private/no-store. `/auth/callback` exchanges the PKCE code and verifies claims. `/api/auth` verifies with `getUser()` before returning minimal identity. Server authorization never uses `getSession()` or local profile IDs.

`src/lib/auth.ts` owns sign-up/sign-in/sign-out and password-change SDK calls. Email/password sign-up supports confirmed email; normal sign-in uses `signInWithPassword`. Email links support recovery: sign in with the link and set a password from account controls. Google OAuth, confirmation links, and email sign-in links return to the same callback; links must open in the initiating browser because PKCE stores a verifier there. `NEXT_PUBLIC_APP_URL` fixes the production callback origin. No arbitrary `next` URL is accepted. Proxy forwards both refreshed cookies and the current SSR SDK's cache headers. Callback and identity network errors fail into recoverable states.

An auth event temporarily unmounts financial views, verifies identity on the server, and mounts a new provider keyed by account and storage mode. Pending profile/month reads are cancelled on unmount. Cloud state is memory-only and never written into guest IndexedDB. Account A's repository filters cannot read account B; database RLS remains the authorization boundary. A failed verification returns to local mode with recovery guidance. Session storage remembers Local/Cloud mode per account, not identity tokens.

Supabase's browser SDK shares session cookies with SSR; these cookies cannot be HttpOnly. Apply HTTPS, restrict script execution, and review XSS protections before production. Publishable keys are browser-safe. Elevated keys are neither required nor read by application code.

## Schema and authorization

The first migration creates profiles, income revisions, recurring sources/revisions, monthly plans, commitment snapshots, daily expenses, categories, and migration receipts. Domain-compatible quoted field names avoid lossy mappings. Currency is INR; `daywise_minor` is a BIGINT domain. Month domains validate supported dates.

Every table forces RLS, with separate SELECT/INSERT/UPDATE/DELETE ownership policies. Anonymous/PUBLIC table grants and function execution are revoked. Authenticated grants are explicit; migration receipts are insert/read only. Identity triggers prohibit changing owner, record ID, or workspace through updates. Composite owner-qualified foreign keys prevent referencing another user's workspace, recurring source, or plan. Receipts retain a nullable owner-qualified workspace reference after profile deletion.

All application functions are SECURITY INVOKER with an empty search path and qualified object names. They require an authenticated caller and workspace ownership, and compound operations take a workspace lock. Import also binds the expected account ID to `auth.uid()` and takes a transaction advisory lock for the account/source pair. RLS remains active inside every function. No service-role client exists in the app. The third migration adds `daywise_set_paid`: the repository supplies the target state rather than toggling database state, so identical save retries do not undo a payment marker.

## Local migration

Account controls offer existing local profiles only after sign-in. Review exports a point-in-time backup and validates schemas, relationships, duplicate IDs/keys, safe totals, recurring sources, categories, and plan parents. The user must download the backup and explicitly consent before upload.

`prepareMigration` deterministically maps every ID and recurring source into account/profile/collection UUID namespaces. SHA-256 of canonical source data identifies retries; export timestamps and collection ordering do not change it. A SQL transaction inserts a separate workspace, all child rows, and a receipt. Constraints and RLS validate the upload again. Stored counts, collection totals, and exact monthly income/fixed/spent totals must match the supplied manifest before commit. The adapter verifies the returned receipt. Existing local rows are never changed. An unchanged retry returns the original receipt; changed source data is rejected instead of merged. A deleted imported workspace cannot be silently recreated by a delayed retry.

## Verification

`src/tests` covers finance, local repository, components, and migration transformation. `supabase/tests/database` exercises real pgTAP under two authenticated identities and anon, plus transaction rollback/idempotency and revision behavior. `e2e/stage-3.spec.ts` has unconfigured guest tests and opt-in local email/PKCE/cloud/browser tests. Google and hosted-production checks require external configuration; local tests do not establish deployment readiness.
