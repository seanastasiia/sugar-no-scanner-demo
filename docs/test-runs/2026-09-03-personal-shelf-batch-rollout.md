# Personal Shelf Rank bounded batch rollout — 3 September 2026

## Scope and acceptance plan

Owner accepted the accelerated first rollout: optional fiber ranges and composition collection in supported categories. This is not a rewrite or global deduplication of all 19k source rows. Original Sugar + Protein Fit stays the default, with the existing camera, offers and shared-web-card path preserved. Contradictory source evidence is a trust exception: its old Fit is also suppressed.

Baseline production/main: `8f43789eb0c6c38a5a04ee67af9c19ac571f01a9`. Merge basis for the existing isolated pilot: `7b4a87f`. Implementation branch: `codex/personal-rank-rollout`.

Technical acceptance planned before implementation:

- Fixed-weight fiber bounds; null/zero/invalid distinction; essential missing and inconsistent labels; ceilings at both endpoints; overlap/tie disclosure; old full-score parity.
- Exact retailer SKU/known GTIN and multilingual identity checks; bounded source requests and HTTP 429 pause; no fabricated composition, cross-source nutrient merge or mixed ODbL storage.
- Supabase migration and atomic upsert/readback, replay/older-data protection, private tables/RPC and local fallback on timeout.
- Full lint/types/unit/integration/catalog/build and Mobile Safari regression suite, small screens, dark mode, reduced motion, enlarged text, no horizontal overflow and axe.
- GitHub main, terminal Railway success, HTTPS health/commit agreement, direct demo and session/origin API protection.

Owner acceptance (physical-store judgment is not automated):

1. Open `/demo/personal-shelf`, compare complete chips with the real PROPER 57–59 range, tap each to inspect its source. The fourth contradictory chip remains unscored; switch to yogurts.
2. On a real shelf, open `View all → Personal Shelf Rank`, compare products within a type and check ingredients/numbers against the package. A missing-salt product stays unscored; an overlapping range does not establish a verified winner.
3. Turn the option off, retry and compare a translated same-SKU name versus a different flavor. Original camera/fit/offers should remain familiar; a different recipe must not inherit evidence.

## Pre-commit checks

Local evidence directory: `/tmp/sugar-no-rank-rollout.298uyg` (temporary, not committed; no secrets, photos or user histories).

- `targeted-tests.log`: model/parser/SQL, 51 passed before the final language-alias regression was added.
- `check-fast.log`: lint, TypeScript and 55 files / 363 tests passed on the initial working tree.
- `score-parity.log`: the original 64 complete baseline scores were unchanged by bounded arithmetic. Final parity is checked again after the precise Latvian flour/category aliases.
- `e2e-first.log`: 37 passed, one obsolete assertion failed because it required all four chips to fit a viewport previously sized for three. The card was reachable by normal scrolling; no rendering exception occurred.
- `e2e-second.log`: all 38 Mobile Safari tests passed after testing above-fold readability plus fourth-card scrolling. Compact chips/yogurts and dark 200%-text screenshots were visually inspected; no clipping or horizontal overflow. Whole-card disclosure, visible provisional text and dashed provisional place preserve the compact layout (informed by a generic Claude design review with no code or private data shared).

## Data and source controls

The batch uses 1,728 known supported-category source candidates. Rimi product-title slugs were excluded from category selection; a dip “for chips” is not a chip. Latvian `milti` now matches the existing flour rule; `sālie cepumi` maps to crackers. Nutrients are not translated or inferred. Each source has one worker and success checkpoints; HTTP 429 pauses that source. Failed pages or changed SKUs preserve older observations. No recurring job was created.

Two sampled Rimi anomalies were re-read directly to distinguish source mistakes from parser mistakes: `100840` really lists saturated fat 64 g with total fat 23 g and sugar 7 g with carbs 2.1 g; `164690` really lists fat 68 g plus carbs 68 g. Both are unscored, not repaired by guessing decimal points or reordering rows. Other contradictions are listed by the validator.

The additive migration `202609030002_personal_shelf_evidence.sql` was applied to the existing approved Supabase project. Pre-seed readback: two RLS-enabled tables, both empty, anonymous SELECT/INSERT denied. Four PGlite migration tests cover source isolation, replay/newer semantics and role restrictions. Final source counts, seed and release verification follow below.

Final snapshot validation: 1,248 observations, 242 complete scores, 716 provisional ranges, 290 unscored (including 19 contradictory tables). Original 64/198 complete pilot scores remain unchanged after both arithmetic and language-alias corrections (`score-parity-final.log`). The initial 198 are now 64 complete + 82 provisional + 52 unscored. All full non-dairy scores lie inside their masked-fiber bounds.

| Source | Candidates | Observations | Complete | Provisional | Failed attempts | Unattempted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Barbora LV | 754 | 333 | 65 | 196 | 69 | 352 |
| Rimi LV | 586 | 559 | 61 | 413 | 27 | 0 |
| Livinn LT | 332 | 331 | 110 | 103 | 1 | 0 |
| Open Food Facts | 56 | 25 | 6 | 4 | 7 | 24 |
| Total | 1,728 | 1,248 | 242 | 716 | 104 | 376 |

Barbora/OFF stopped on HTTP 429; Rimi/Livinn completed their queues. No retries or background job remain active. The 1,050 successful new observations plus the original 198 make 1,248. `.catalog-sync/personal-shelf-batch-report.json` retains attempts/coverage locally; `--report-only` reproduces reporting and files from the checkpoint without network calls. Raw current-source failures include 404, exact-SKU redirects, unparseable labels and source throttling; none became invented facts. Retailer reuse/recurring collection remains subject to permission, and no claim of a uniquely rated 19k-product database is made.

## Final verification

Tested application commit: `370a73cafbd77739a442bbcd97e732f543eccb47`. A documentation-only release commit follows; application/data/migration trees are unchanged.

- `npm run verify`: PASS, ESLint, TypeScript, 55 files / 364 Vitest tests, all three catalog validators, Next.js optimized build and standalone assets. Output: `verify-final.log` in the evidence directory above.
- `CI=1 E2E_PRODUCTION=0 SHARED_WEB_CATALOG_ENABLED=true PERSONAL_SHELF_RANK_ENABLED=true npm run test:e2e`: PASS, 38/38 Mobile Safari tests, 1.5 minutes, on the tested commit. Output: `e2e-final.log`. Expected request-cancellation ECONNRESET messages occurred in abort/retry scenarios without failed assertions.
- Supabase SDK seed/readback: PASS, all 1,223 retailer and 25 OFF rows verified, no rows deleted. Output: `supabase-seed.log`. No synthetic fixture was inserted into production.
- Independent SQL readback: 1,223 retailer rows, 25 OFF rows, no anonymous read or RPC execution, no authenticated insert. All 1,023 retailer observations with absent fiber retain SQL/JSON null, not zero. RLS is enabled on both evidence tables.
- Dry-run, checkpoint report-only and snapshot validator passed (`catalog-report.log`, `catalog-validation.log`, `seed-dry-run.log`). Complete/provisional totals and source accounting are recorded above.
- Final old/new complete-score parity: 64 unchanged, zero changed complete baseline scores; no source values modified (`score-parity-final.log`).

Release lane: GitHub `main`, then explicit Railway CLI deployment to service `6d0d8abe-cb63-4d29-96bd-c3a290be3e7c`, project `9e2a4887-0e19-4ca7-ae99-d68816542558`, environment `production`. Set `PERSONAL_SHELF_RANK_ENABLED=true`; preserve `SHARED_WEB_CATALOG_ENABLED=true`. Do not update the separate preview/staging services.

Production completion, terminal deployment ID/status and HTTPS smoke results are recorded in the dated shared Sugar.no Update only after actual live verification. Required smoke: root/session, unauthenticated 401, cross-origin 403, exact-source evidence including a null-fiber range and contradiction, existing barcode/Shelf demo, and `/api/health` matching main SHA with 1,248/242/716/290 snapshot counts. Rollback hides the new feature with `PERSONAL_SHELF_RANK_ENABLED=false` plus redeploy; it does not delete evidence or change default Fit.
