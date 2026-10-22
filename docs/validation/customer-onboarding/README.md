# Local customer-onboarding validation

Final successful command outputs are retained beside `results.json`. All database and authenticated browser fixtures used the disposable local Supabase stack. No session credentials are logged.

`deployment.log` is `npm run test:deployment` (maintenance); `deployment-locked.log` uses the existing local `SPENDENSE_TEST_APP_MODE=staging` boundary check; `deployment-build.log` uses `SPENDENSE_TEST_PRODUCTION=1` after a separate local `NEXT_PUBLIC_APP_MODE=maintenance npm run build`. This creates no hosted staging environment and changes no deployment variables.

Configuration/project skips are intentional: cloud cases run in `test:cloud`, missing-configuration cases run in `test:e2e`, and the narrow-device case runs only in the mobile project. Hosted Supabase, hosted OAuth and outbound email were not tested. See the report and operator rollout guide for the release boundary.
