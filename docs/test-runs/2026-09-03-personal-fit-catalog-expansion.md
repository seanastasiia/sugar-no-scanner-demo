# Personal Fit catalog expansion — preview QA

Date: 3 September 2026  
Implementation commit: `6928c8b072cf2d46ce52fecc1b3baed65620241a`  
Target: isolated Railway `personal-rank-preview`; production `main` is out of scope.

## Result

- Model `personal-shelf-v1.3-bounded` adds twelve category profiles while retaining the original seven profiles.
- The full checked-in inventory audit accounts for 19,524 distinct source IDs exactly once. It reports 2,596 assessable rows, 4,321 supported-type rows with insufficient exact evidence and 12,607 unsupported rows. These are source rows, not globally unique physical products.
- Checked-in exact evidence contains 4,102 observations: 813 complete scores, 1,783 provisional ranges and 1,506 unscored observations. Thirty contradictory tables fail closed.
- The offline calibration report flags candy's one-band concentration, low assessable coverage for sauce and ice cream, and bread ranges crossing presentation bands. No score is normalized to hide those warnings.
- Barcode lookup rejects checksum-invalid retailer codes; exact source identity and multilingual name matching remain available. No cross-retailer recipe or nutrition merge is introduced.
- Source queues persist absolute cooldowns and report zero runnable work while Barbora/Open Food Facts are rate-limited. No scheduler or autonomous retry exists.

## Technical checks

All checks below ran against the committed implementation tree.

| Check | Result |
| --- | --- |
| `npm run verify` | Passed: ESLint, TypeScript, 64 Vitest files / 534 tests, catalog validators and standalone Next.js build |
| `npm run catalog:validate:shelf-pilot` | Passed: 4,102 observations, 813 complete, 1,783 provisional, 30 contradictions quarantined |
| `npm run catalog:audit:personal-fit` | Passed: all 19,524 source IDs accounted for once; no duplicate source/evidence IDs |
| `npm run catalog:report:personal-fit -- --write` | Passed: 2,596 assessable / 1,506 unscored evidence observations; four explicit calibration alerts |
| `npm run catalog:sync:shelf-batch` | Passed dry run: zero runnable jobs while Barbora/OFF cooldown boundaries remain active; no network writes |
| `E2E_PORT=3102 CI=1 npm run test:e2e -- --workers=1 --retries=0 --fully-parallel --shard=1/2` | Passed: 29/29 Mobile Safari scenarios |
| `E2E_PORT=3103 CI=1 npm run test:e2e -- --workers=1 --retries=0 --fully-parallel --shard=2/2` | Passed: 29/29 Mobile Safari scenarios |
| `git diff --check` | Passed before commit |

Transient local Next.js `ECONNRESET` messages occurred when Playwright navigated away from requests; all assertions passed without retry. The existing image aspect-ratio warning remains unrelated to this scoring/data change.

## Product checks for the owner

1. Open the isolated preview, upload a shelf photo and enable `Personal Shelf Rank` in `View all`.
2. Try two products of one newly supported type, such as chocolate, pasta, cheese or prepared fish. Confirm they appear in one category-local group with Great/Moderate/Low badges only when score evidence exists.
3. Open a scored and a provisional card. Confirm protein/sugar match the package and a missing fiber value is presented as a range, not invented.
4. Try a product with no exact composition source or a different flavour/pack. It must remain neutral and unranked rather than inherit another product's evidence.
5. Disable Personal Shelf Rank and confirm the original Sugar + Protein Fit, camera markers, offers and ordering are unchanged.

This test set proves deterministic code, catalog accounting and mocked mobile flows. It does not prove physical-store recognition coverage or that the preference model is a clinical health rating.
