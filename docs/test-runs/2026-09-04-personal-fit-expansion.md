# Bounded Personal Fit expansion — 4 September 2026

Scope: `codex/personal-fit-catalog-preview`, based on `b4e74534d08adc3a0b4be7f8fbd485f122c9c29a`. Model `personal-shelf-v1.5-bounded`. No main/production push, remote database change, paid-provider request or scheduler. The execution checklist is in `docs/personal-fit-expansion-plan.md`.

## Initial enrichment result

| Measure | Before | After |
| --- | ---: | ---: |
| Source inventory records | 19,524 | 19,524 |
| Exact observations | 4,102 | 4,509 |
| Complete assessments | 1,225 | 1,287 |
| Provisional assessments | 2,110 | 2,363 |
| All assessable | 3,335 | 3,650 |

The 200-ID pilot accepted 140 observations and added 86 assessments; its isolated 41-request Rimi parser retry is included. 307 reviewed category IDs yielded 297 accepted pages and 229 more assessments. Combined: 407 new observations and 30 updates of previously unscored observations. This is source-record coverage, not globally unique products or camera accuracy.

`npx tsx scripts/report-personal-fit-expansion.ts --write` compares each old assessment and demo with pinned v1.4: PASS, no removed evidence, no changed prior 3,335 assessments, no changed demo assessments. Audit: no duplicate source/evidence IDs; 34 contradictory tables remain unscored. Bread cross-band ranges, candy band concentration and low ice-cream coverage remain calibration limitations.

## Technical acceptance

- `npm run verify`: PASS, 68 test files / 630 tests, lint, TypeScript, catalog validators and standalone production build. Log: `/tmp/sugar-no-expansion-verify-final.log`.
- Tests cover exact Rimi quantity versus conflicting/missing labels, category-positive/negative examples, explicit batch scope and 403/429 cooldowns, nullable OFF languages/nutrition, importer deduplication/source separation/idempotence, and 13 isolated PostgreSQL shared-card cases. Shared composition is default-off; no live Supabase migration is claimed.
- `npm run catalog:audit:personal-fit -- --write`, `npm run catalog:report:personal-fit -- --write`, and `npx tsx scripts/report-personal-fit-expansion.ts --write`: PASS. Reports stay under ignored `.catalog-sync/`; regression baseline is pinned in the script.
- Mobile Safari: PASS, 58/58, one worker, no retries, sequential fresh dev servers: `E2E_PORT=3114 E2E_PRODUCTION=0 CI=1 npm run test:e2e -- --workers=1 --retries=0 --fully-parallel --shard=1/2`, then port 3115 / shard 2/2. Logs: `/tmp/sugar-no-expansion-e2e-dev-1.log`, `/tmp/sugar-no-expansion-e2e-dev-2.log`.
- Exploratory local `E2E_PRODUCTION=1` HTTP runs failed protected API requests because production Secure cookies are not sent over HTTP. This is the already documented harness limitation, not weakened by a code workaround. Railway HTTPS smoke is the built-server acceptance gate.
- `git diff --check`: PASS. Generated `next-env.d.ts` restored to its original tracked form after the build.

OFF extraction remains a separate staged job until an accepted candidate/report is committed. Partial Parquet files were not promoted. Whole CSV output lacks trustworthy ingredient-language labels, so no language or rating is inferred from its product names or market tags.

## Release and owner acceptance

Deploy only to project `9e2a4887-0e19-4ca7-ae99-d68816542558`, environment `personal-rank-preview`, service `37730464-07ba-482d-9c59-74c04ecdf6db`. Require terminal SUCCESS, matching HTTPS health revision/counts, original Shelf/Checkout demo smoke and exact evidence checks. Keep both shared-catalog flags off until isolated Supabase approval and acceptance.

Owner: refresh preview → try the same real shelf → View all → Personal Shelf Rank. Verify protein/sugar against the exact physical variant, a provisional card still discloses unknown fiber, and unsupported/conflicting cards stay neutral. Switch back to original Fit and check the chip demo still shows 64/61/57–59/unscored. More evidence does not guarantee that every visible package is recognized.
