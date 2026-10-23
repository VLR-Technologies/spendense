# Merge-resolution validation evidence

Fresh verification of the merge of origin/main f120a0c into UI-upgrade 8e2fe3a on 2026-10-23. See the root MERGE_RESOLUTION_REPORT.md for decisions, dependencies, limitations and release prerequisites.

- secrets.txt, lint.txt, types.txt, unit.txt, build.txt: required static/unit/build checks.
- cloud.txt: full npm run test:cloud against disposable local Supabase; 42 pass, 4 expected skips.
- cloud-initial.txt: initial focused run; two failures in the new test caused by an ambiguous alert locator, subsequently fixed and covered in the full successful run.
- guest.txt: npm run test:e2e with cloud configuration explicitly empty; 30 pass, 16 expected skips.
- deployment.txt: npm run test:deployment on local maintenance mode; 2 pass.
- db.txt: npm run db:test on local Supabase; 157 assertions pass.
- migration-replay.txt: fresh isolated local PostgreSQL database, exact four migrations, synthetic pre/post financial history comparison and 157 pgTAP assertions.
- source-review.json: exact input commits and reviewed conflict blobs; financial code equivalence between branches.
- production-observation.json: public redirect and provider-availability observations only. No Google login or remote database operation.
- screenshots/: representative newly captured synthetic desktop/mobile landing and customer dashboard views.

Text logs have terminal colors and trailing whitespace removed for readability; test outcomes are unchanged. All automated records are synthetic. No Google credentials, elevated API keys, session tokens or customer records are included. Hosted Google sign-in remains a separate operator smoke test.
