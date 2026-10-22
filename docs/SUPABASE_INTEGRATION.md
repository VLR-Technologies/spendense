# Supabase integration

**Spendense** retains optional Supabase accounts and IndexedDB guest workspaces. Deployment now defaults to a locked maintenance page: no authentication or financial records are read or written until `NEXT_PUBLIC_APP_MODE=live` is explicitly enabled after approval. `staging` is also locked. See the [deployment report](../DEPLOYMENT_REPORT.md) for current validation and launch requirements. Local environment values are not published in documentation; no migration or deployment was performed during deployment preparation.

## Authentication and sessions

The existing account dialog provides email/password **Create account** and **Sign in with email**. Sign-up supports email confirmation; a confirmation-required response does not imply an authenticated session. An email link remains available for password recovery or password-free access. After signing in with the link, **Manage account → Change password** sets a new password. Google remains an optional existing provider and requires separate provider configuration.

Browser and per-request server clients use `@supabase/ssr`. Next.js 16 `src/proxy.ts` refreshes sessions with `getClaims()`, forwards refreshed request and response cookies, and applies the SDK's cache headers. `/api/auth` obtains verified identity with `getUser()`. `/auth/callback` exchanges a PKCE code, verifies claims, and redirects to the fixed dashboard destination. Invalid/expired links and network failures offer recoverable errors without exposing codes or tokens. Production cookies are Secure and SameSite=Lax. Auth responses use private/no-store caching. Server authorization never trusts `getSession()`.

Identity transitions unmount the financial workspace. Each cloud provider/repository belongs to one verified account. Cloud financial state stays in memory and is never copied into IndexedDB. Browser SDK session cookies must remain accessible to the SDK; they are not HttpOnly. Serve production over HTTPS and keep session responses out of CDN caches.

References: [Supabase SSR setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [password authentication](https://supabase.com/docs/guides/auth/passwords), and [SSR caching](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## Repository boundary and financial behavior

`CloudRepository` implements `DaywiseRepository`, the same contract used by the existing local adapter. Dashboard, Calendar, Monthly Plan, Expenses, Insights, Settings, categories, profile management, and backups use the selected adapter. Guest profiles retain the `daywise-local-v1` Dexie schema and storage keys.

`src/lib/finance.ts` is unchanged. Financial amounts remain integer paise in TypeScript and PostgreSQL BIGINT, constrained to the existing supported per-record range. SQL stores income revisions, recurring revisions, and monthly snapshots; financial allocations continue to run through the existing pure engine. Earlier snapshots, one-time commitments, future defaults, month overrides/exclusions, and paid metadata retain their existing behavior. Payment saves specify the intended boolean state, making identical retries safe without deducting an expense twice.

Cloud operations require connectivity and report failures. No automatic offline queue, background upload, or history merge is implemented. Same-record concurrent edits follow the last successful write; refresh before making further edits after an interrupted operation.

## SQL migrations and ownership

After separate approval, apply these files in order through the procedure in [SUPABASE_SETUP.md](../SUPABASE_SETUP.md):

1. `supabase/migrations/202610220001_schema.sql`: profiles, income revisions, recurring sources and revisions, monthly plans and commitments, daily expenses, custom categories, migration receipts, indexes, constraints, RLS, and grants.
2. `supabase/migrations/202610220002_operations.sql`: transactional month materialization, income/recurring propagation, payment/removal, export, and consented-import persistence operations.
3. `supabase/migrations/202610220003_payment_state.sql`: idempotent payment-state RPC used by the cloud repository. The previous migrations remain unchanged for installations that already applied them.

All nine exposed tables enable and force RLS. Policies require `auth.uid() = owner_id`; UPDATE also checks the resulting owner. PUBLIC/anonymous table access is revoked. Composite foreign keys ensure children can reference only a profile, plan, or recurring source owned by the same account. Identity triggers prohibit owner, record ID, or workspace reassignment. Migration receipts cannot be updated or deleted by authenticated clients.

All application RPCs are SECURITY INVOKER with an empty search path and explicit execution grants. RLS applies inside them. Workspace locks serialize compound operations; import additionally serializes each account/source pair. No service-role key is used by the application.

The SQL files are numbered migration artifacts intended for version control. This supplied directory has no `.git` repository, so no Git commit was possible. Include these files and their tests in your normal repository commit.

## Local-data migration requires consent and backup

Signing up, signing in, and switching storage modes never upload local financial records. Account → Import a local profile → Review requires a backup download and an explicit checkbox naming the destination account before the import button becomes available. Settings file imports into cloud storage use the same backup/consent requirement.

The import validates the backup and relationships, deterministically maps identifiers into the destination account namespace, and creates a separate cloud profile. A single authorized SQL transaction inserts every collection and an import receipt, then verifies record counts and exact monetary totals. An identical retry returns the receipt; a changed source conflicts rather than silently merging histories. Failed transactions roll back. The original IndexedDB profile and downloaded backup remain available. No local profile is automatically deleted.

## Verification and production activation

See [SUPABASE_IMPLEMENTATION_REPORT.md](../SUPABASE_IMPLEMENTATION_REPORT.md) for this integration's executed results, and [STAGE_3_REPORT.md](../STAGE_3_REPORT.md) for earlier implementation history.

Automated browser tests explicitly override `.env.local`: the guest suite clears Supabase configuration; the cloud suite accepts only the disposable loopback Supabase stack and uses local Mailpit. Tests do not create users or write financial records in the configured hosted project. SQL tests exercise two authenticated identities and anonymous requests with transaction rollback.

Before production activation, apply all pending migrations after approval, set the canonical HTTPS app origin and exact callback allowlist, enable email confirmation, and configure production SMTP. Verify actual hosted email delivery, session refresh/logout, and two-account REST/RPC isolation against staging. Local acceptance does not verify hosted infrastructure or delivery. No production database changes or deployment are included in this task.

Legacy `daywise_*` SQL/RPC names, storage keys, migration namespaces, environment names, and backup `format: "daywise"` remain compatibility contracts. See [architecture](ARCHITECTURE.md) for further operating limits.
