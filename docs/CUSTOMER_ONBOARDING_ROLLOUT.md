# Customer onboarding database rollout — operator review

This guide is a handoff, not evidence of a hosted migration or deployment. Only the disposable local Supabase stack has been changed/tested. The intended hosted database remains the existing Spendense project. No new hosted/staging database is needed.

## Exact change

Review the complete versioned migration at [`supabase/migrations/202610230001_customer_preferences.sql`](../supabase/migrations/202610230001_customer_preferences.sql). Apply that exact file once, after separate authorization for the hosted project. It depends on the existing `202610220001_schema.sql` and `202610220002_operations.sql` migrations and their financial domains/RPCs. Do not alter the migration after it has been applied; use another additive migration for later changes.

The migration adds:

- `public.customer_financial_preferences`, keyed by the verified Auth user UUID, with one configuration per registered customer, completion timestamp, revision and last request UUID.
- Owner-only authenticated SELECT/INSERT/UPDATE/DELETE policies, forced RLS, explicit authenticated grants and no anonymous table privileges.
- Structural/amount/schedule constraints and a validation trigger. Business configuration must be monthly personal take-home; daily rates require unique paid weekdays. Salary/business values are not stored in Auth metadata.
- `public.spendense_save_customer`, a SECURITY INVOKER RPC with an empty search path. Advisory locking serializes saves for the same account; revision and current allocation comparisons reject stale reviews. The request UUID makes a repeated successful request idempotent. A confirmed financial update and completion commit together using the existing `daywise_income` operation and its ownership lock.

There are no changes to financial table IDs, existing foreign keys, RLS policies, storage keys or finance arithmetic. There is no backfill or customer-history rewrite. Full name and optional preferred name continue using existing Supabase Auth metadata. The monthly plan/revisions remain the authority for financial calculations; this new table contains input preferences for explicitly reviewed estimates.

## Before hosted rollout (operator only, after authorization)

1. Confirm the target is the existing Spendense Supabase project, inspect its migration history, and confirm the prerequisite migrations/functions match the branch. If they differ, stop and reconcile; do not reset or force a migration.
2. Arrange an existing-project backup/recovery point under the project's normal procedure. Record row counts and representative synthetic test-account totals; do not use real customer data as automated fixtures.
3. Review the SQL, including grants, policies and security-invoker execution. Confirm Auth full-name updates are enabled by the existing Auth configuration. No new environment variables, secrets, external services or Auth provider changes are required.
4. Independently reproduce the local checks with `npm run db:start`, `npx supabase migration up --local`, `npm run db:test`, and `npm run test:cloud`. These commands are local-only.

## Authorized hosted migration order

1. Through the operator's approved migration process, apply **only** `202610230001_customer_preferences.sql` to the existing project and record its version in the migration history consistently with that process. Do not replay all historical migrations or use a database reset. This task has not executed any hosted command.
2. Verify the new table, primary key, constraints, validation trigger, four owner policies, authenticated grants, and RPC signature exist. Confirm both the table and RPC deny anonymous access and the RPC is not SECURITY DEFINER.
3. With two dedicated operator-controlled test accounts, verify A cannot read/update/delete B's preferences or complete B's budget. Confirm legacy budgets and their totals are unchanged. Do not use service-role access in the frontend.
4. Only after separate application-release approval, release the reviewed UI commit through the normal process. Keep `UI-upgrade` as the delivery branch for this task; do not merge/change `main`, the Vercel Production Branch, or deployment variables as part of this work.
5. Smoke-test signup confirmation, email-link login, any already-configured OAuth, the new one-time wizard, a legacy account, a preference-only edit, an explicit monthly override, sign-out/account switch, guest access and consented imports. Hosted OAuth/email-provider behavior remains unverified until that operator check.

## Compatibility and recovery

Deploying the schema first is backward compatible: the old app does not read it. If a UI is opened before the schema is installed, it reports that Personal & Income Details need the service update and leaves existing budgets accessible; it does not fabricate completion, reset storage or fall back to another identity.

If application rollout needs reversal, restore the previous application version through the normal authorized process and **leave the additive table/policies in place**. Do not drop customer preferences, restore over financial records, or delete Auth users. A failed save transaction rolls back its optional income change and completion. An Auth name update is a separate existing Auth operation and may succeed before a preferences save fails; retry is safe, and names never authorize record access.

Weekly estimates use rate × 52 ÷ 12 rounded to nearest paise with BigInt. Daily estimates count selected weekdays in the chosen calendar month, excluding no holidays or unpaid leave automatically. Applying an estimate as a future default stores the confirmed constant monthly allocation; it does not automatically recalculate future salary or rewrite past months. Users retain the original income controls and monthly overrides for changing earnings. The new RPC permits allocation writes only for the current/future database calendar month.
