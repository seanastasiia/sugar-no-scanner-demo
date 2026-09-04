# Personal Fit ingredient vocabulary, 4 September 2026

## Scope and revision

- Owner approved the previously identified 1,047 single-blocker observations, not the separate web-search pilot or production release.
- Implementation commit: `75a63f69d2b9cb1a6a03ddb8f32156df626080bf` on `codex/personal-fit-catalog-preview`.
- Baseline: `47e9664686fde04945201b13e7e4b4414e7fe75d`, model v1.3. New model: `personal-shelf-v1.4-bounded`.
- No source-data files, product identities, legacy Fit rules, category weights, nutrient curves or UI files changed. No external catalog fetch, paid model request, database write or scheduler.
- Production/main remains separately controlled at `ab813c710f41ee7423f19ff35acb95381140c98d`.

## Reproducible coverage and regression check

`npm run catalog:report:ingredient-impact -- --write` compares the same 4,102 evidence observations plus four ordinary Shelf-demo observations with the pinned prior model. It verifies identical source bytes and records their SHA-256 hashes, every before/after assessment and every cohort disposition in `.catalog-sync/personal-fit-alias-impact.json`. It fails on any changed previously assessable assessment or demo assessment (model ID excluded).

| Measure | Before | After |
| --- | ---: | ---: |
| Exact observations | 4,102 | 4,102 |
| Complete assessments | 813 | 1,225 |
| Provisional assessments | 1,783 | 2,110 |
| All assessable observations | 2,596 | 3,335 |
| Unscored observations | 1,506 | 767 |

All 1,047 candidates were reviewed by the bounded rules and per-ID report: 739 unlocked (412 complete, 327 provisional), 308 remain blocked. No additional observation outside that cohort became assessed. All prior 2,596 assessed results and the demos remain identical. The four chip examples still show 64, 61, 57-59 and no score.

Unlocks by rule: 279 dairy labels, 198 whole-plant labels, 164 refined-grain/compound labels, 59 cocoa-mass labels, 38 animal labels and one milk-powder label. Milk powder matches existing English milk-base semantics; it is not inferred to be isolated protein. Animal shares in parentheses still receive the existing limits.

The initial vocabulary pass yielded 748, then explicit inspection added malformed-bracket, animal-fat/extract and category-conflict safeguards. Final acceptance is 739, not the preliminary number. Two known new category conflicts stay unscored: Barbora `bubble-gum-saldejums-zemnieku-65-g` (ice cream in a wafer cone) and OFF `4750050000715` (curd filed as biscuits). Water/oil-first records, generic fillings/cereals and unsupported wording need source/model review; they are not silently assigned an average or a low score.

The full offline inventory audit reports 19,524 source IDs: 3,335 assessable, 3,582 supported-type missing-data rows, 12,607 unsupported. There are no duplicate source/evidence IDs. These are source records, not globally unique physical products. The quality report still flags candy's Low-fit concentration, bread's cross-band ranges and low ice-cream coverage. Source errors beyond current guards remain possible.

## Technical checks

- `npm run verify`: PASS, ESLint with no warnings, TypeScript, 65 files / 596 tests, all catalog validators and production/standalone build. Run on the working tree committed unchanged as `75a63f6`. Log: `/tmp/sugar-no-v14-verify.log`.
- New vocabulary tests cover five languages, word boundaries, source-language gates, oils versus plants, extracts, fractions, unknown/water-first compounds, bracket balance, source-zero conflicts, exact essential fields, category conflicts, animal shares and the unchanged sugar ceiling. No snapshots or nutrients are synthesized.
- `npm run catalog:audit:personal-fit -- --write`: PASS, 19,524 source records reconciled.
- `npm run catalog:report:personal-fit -- --write`: PASS; retained calibration warnings described above.
- `npm run catalog:report:ingredient-impact -- --write`: PASS; identical input bytes and no previous-assessment/demo changes.
- Mobile Safari full suite: PASS, 58/58 (29+29), two fresh servers, one worker and zero retries, on `75a63f6` code. Commands: `E2E_PORT=3104 CI=1 npm run test:e2e -- --workers=1 --retries=0 --fully-parallel --shard=1/2`, then port 3105 / shard 2/2. Logs: `/tmp/sugar-no-v14-e2e-1.log`, `/tmp/sugar-no-v14-e2e-2.log`. Existing logo-aspect/dev-server warnings do not fail the assertions.
- Additional all-unlocked-record checks: PASS, 3,695 essential-null checks, 739 wrong-identity checks, 2,616 missing-fiber endpoint checks, zero input mutations.
- `git diff --check`: PASS.

## Preview release

Final code/browser acceptance passed. Deploy only `codex/personal-fit-catalog-preview` to Railway project `9e2a4887-0e19-4ca7-ae99-d68816542558`, environment `personal-rank-preview`, service `37730464-07ba-482d-9c59-74c04ecdf6db`. Acceptance requires a terminal SUCCESS deployment and matching live health commit/model/counts, plus root/demo and exact evidence checks. The post-deploy record is written to ignored `test-results/personal-fit-v14-release.json` and the scoped shared-context update. Never push this task to main or copy production database credentials into preview.

## Owner product check

1. Reload the independent preview and upload/scan a supported known package, then open View all and enable Personal Shelf Rank.
2. Useful exact examples: APP LITE apple/berry bar (`barbora:abolu-batonins-ar-ogam-app-lite-35-g`, 46-56 provisional with unknown fiber); Gefilus blueberry yogurt 380g (`barbora:jogurts-gefilus-ar-mellenem-2-proc-380-g`, 75); Pik-Nik cheese sticks (`rimi_lv:121444`, 51); Casareccia pasta (`livinn_lt:1AM090400086`, 64). These expectations use the dated source records, not guaranteed current packaging.
3. Check protein/sugar against the physical label. Fruit wording must not erase the high-sugar limit, and missing fiber must stay provisional. A different flavour/pack must not borrow the example's evidence.
4. Open the rating demo: its chip scores/layout must be unchanged. Switch Personal Shelf off on a scan to restore original Fit.

This is rating coverage after an exact match, not a new camera-recognition accuracy benchmark or a clinical health rating. The 308 blocked candidates need a separately scoped follow-up; this task did not start web enrichment.
