# Personal Shelf score disclosure release — 9 September 2026

## Scope

The Personal Shelf card is lighter in both real recognition and `/demo/personal-shelf`: the always-visible Sugar/Protein/per-100-g strip and standalone reason are removed. A shared compact `Why this score` disclosure keeps its label on the left and arrow on the right; opening it shows awarded Sugar, Protein, Ingredients and Balance points. The dedicated 59-point-ceiling explanation panel is hidden, but scoring rules, thresholds, evidence, ranks and Fit bands are unchanged.

## Shared-renderer checks

- The standalone demo and real recognition results import the same `PersonalShelfResults` component.
- Exact and provisional cards expose the same 44 px disclosure row.
- Exact components display `awarded / available`; provisional Balance preserves its real range.
- The demo still requests no camera, recognition API or product API.
- The old nutrition strip is absent in demo and recognition results.

## Technical verification

Verified locally on branch `codex/demo-button-row-preview`, based on production/GitHub `main` commit `f029100bf489d78d4922962817491c21cada5a68`:

- `git diff --check` — passed.
- `npm run verify` — passed: ESLint, TypeScript, 77 Vitest files / 701 tests, catalog validators and the production build.
- `CI=1 E2E_PORT=3012 npm run test:e2e` — all 61 Mobile Safari scenarios passed, including shared demo/recognition rendering, 320 px, enlarged text, dark mode, reduced motion, portrait/landscape and WCAG checks.
- Local visual inspection — collapsed and expanded demo cards preserve hierarchy, keep the disclosure touch target at 44 px and show no horizontal overflow.

## Production release

- Application commit: `a4ba09f8ff558fc908bda25e139780a79c0c5136` on GitHub `main`.
- GitHub-triggered Railway deployment `bdffd276-3589-4226-833d-a3989bb33655` and explicit clean-checkout deployment `1c53dec0-c9eb-4e28-96b8-a6a514d9afb2` both reached `SUCCESS`.
- Live `/api/health` returned `status: ok` and exact application commit `a4ba09f8ff558fc908bda25e139780a79c0c5136`; production `/` and `/demo/personal-shelf` both returned HTTP 200.
- Live Mobile Safari smoke found three cards and three `Why this score` rows, no nutrition strip, no separate 59-point panel, a 44 px disclosure target, label before arrow, four expanded component rows, no horizontal overflow and no demo API request.
- Immediate rollback tag: `production-before-personal-score-disclosure-2026-09-09` at `f029100bf489d78d4922962817491c21cada5a68`.

## Owner acceptance

1. Open production `/demo/personal-shelf` and confirm each card shows `Why this score` on the left and the arrow on the right.
2. Confirm the old Sugar/Protein/per-100-g strip is absent.
3. Open an exact card and confirm four compact point values; open the provisional card and confirm Balance remains a range.
4. Repeat on a real rated scan after enabling Personal Shelf Rank, then disable it and confirm original Fit is unchanged.
