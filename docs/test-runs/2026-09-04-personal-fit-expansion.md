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

The initial result was released as `e606422adc857e4275c8831fa7b67d3bb7a21dcd`; Railway deployment `bfcd0e71-f5b7-43bc-b600-84b8eee067af` reached SUCCESS and passed the original HTTPS smoke.

- `npm run verify`: PASS, 68 test files / 630 tests, lint, TypeScript, catalog validators and standalone production build. Log: `/tmp/sugar-no-expansion-verify-final.log`.
- Tests cover exact Rimi quantity versus conflicting/missing labels, category-positive/negative examples, explicit batch scope and 403/429 cooldowns, nullable OFF languages/nutrition, importer deduplication/source separation/idempotence, and 13 isolated PostgreSQL shared-card cases. Shared composition is default-off; no live Supabase migration is claimed.
- `npm run catalog:audit:personal-fit -- --write`, `npm run catalog:report:personal-fit -- --write`, and `npx tsx scripts/report-personal-fit-expansion.ts --write`: PASS. Reports stay under ignored `.catalog-sync/`; regression baseline is pinned in the script.
- Mobile Safari: PASS, 58/58, one worker, no retries, sequential fresh dev servers: `E2E_PORT=3114 E2E_PRODUCTION=0 CI=1 npm run test:e2e -- --workers=1 --retries=0 --fully-parallel --shard=1/2`, then port 3115 / shard 2/2. Logs: `/tmp/sugar-no-expansion-e2e-dev-1.log`, `/tmp/sugar-no-expansion-e2e-dev-2.log`.
- Exploratory local `E2E_PRODUCTION=1` HTTP runs failed protected API requests because production Secure cookies are not sent over HTTP. This is the already documented harness limitation, not weakened by a code workaround. Railway HTTPS smoke is the built-server acceptance gate.
- `git diff --check`: PASS. Generated `next-env.d.ts` restored to its original tracked form after the build.

## Final OFF/data pass

The pinned TSV stream completed in 1,020 seconds and scanned 4,535,553 rows. Of 15,669 regional rows, 500 were already present, 596 new GTINs passed import and 14,573 were rejected. `data/open-food-facts-regional-import-report.generated.json` preserves counts, source version and the candidate SHA-256, independently verified against the 596-row file. Repeating the importer plans zero additions. The original 500-row file remains byte-for-byte identical to the baseline. Failed exploratory Parquet/quote-delimited CSV partial files were not promoted. The corrected reader passes three Python regression tests, including literal quote preservation and malformed-row rejection.

Exact OFF v3 follow-ups made 186 product reads: 50 original / 48 accepted / 19 new assessments; 136 regional / 124 accepted / 43 new assessments. Source name, brand, pack and barcode must still agree, and missing ingredient language is never inferred. Both queues completed without a source cooldown or paid-provider call. The saved checkpoints and per-ID impact reports remain under ignored `.catalog-sync/expansion-2026-09-04/`.

| Final measure | Baseline | Final candidate |
| --- | ---: | ---: |
| Source records, not globally unique products | 19,524 | 20,120 |
| OFF source records | 500 | 1,096 |
| Exact observations | 4,102 | 5,150 |
| Complete assessments | 1,225 | 1,343 |
| Provisional assessments | 2,110 | 2,369 |
| All assessable | 3,335 | 3,712 |

Final per-ID regression: +377 assessments, zero changed prior assessments, zero changed demos, zero removed evidence. Audit: 3,605 supported incomplete rows, 12,803 outside current profiles, no duplicate source/evidence IDs, and 34 contradictory observed tables still unrated. Barcode package labels now preserve `g` versus `ml` and both are tested. Category calibration warnings remain; this is not a visual-recognition benchmark.

Second-phase preflight: 70 Vitest files / 643 tests, full validators/build and 58 Mobile Safari cases passed before the final regional evidence promotion.

Final implementation commit: `823f83c66fcfb48cdba03dc1424783315c9801b7`. `npm run verify` passed all 643 tests, lint, types, validators and production build (`/tmp/sugar-no-expansion-final-verify.log`). `python3 scripts/test_off_tsv.py` passed 3 tests. Final Mobile Safari: shard 1 passed 29/29; shard 2 passed 28/29, with `page.goto: Provisiolal navigation canceled` before the Barbora scenario's product assertions. Its auth request returned 200 and the document request never received an HTTP response. The adjacent pair passed 5/6 repeated cases; the Barbora case alone passed 2/3, with the remaining run timing out at the same initial navigation. Assertions, timeouts and production cookie protections were not weakened.

The failed trace was preserved at `/tmp/sugar-no-final-navigation-failure-823f83c/trace.zip`. Logs: `/tmp/sugar-no-expansion-final-e2e-1.log`, `/tmp/sugar-no-expansion-final-e2e-2.log`, `/tmp/sugar-no-expansion-navigation-recheck.log`, `/tmp/sugar-no-expansion-barbora-isolated-3.log`. Moving the 1.2 GB generated Next cache aside did not cure local startup failures; its recoverable copy is `/tmp/sugar-no-next-cache.S7ZAWd/next`. This is an unresolved local acceptance limitation, not a claimed fix or a clean final 58/58 run. The unchanged deployed preview opened in three fresh WebKit contexts over HTTPS (HTTP 200 in 1.4/1.0/0.7 seconds). Candidate deployment is preview-only and requires fresh HTTPS health, exact-data and browser acceptance before handoff.

## Release and owner acceptance

Deploy only to project `9e2a4887-0e19-4ca7-ae99-d68816542558`, environment `personal-rank-preview`, service `37730464-07ba-482d-9c59-74c04ecdf6db`. Require terminal SUCCESS, matching HTTPS health revision/counts, original Shelf/Checkout demo smoke and exact evidence checks. Keep both shared-catalog flags off until isolated Supabase approval and acceptance.

Owner: refresh preview → try the same real shelf → View all → Personal Shelf Rank. Verify protein/sugar against the exact physical variant, a provisional card still discloses unknown fiber, and unsupported/conflicting cards stay neutral. Switch back to original Fit and check the chip demo still shows 64/61/57–59/unscored. More evidence does not guarantee that every visible package is recognized.
