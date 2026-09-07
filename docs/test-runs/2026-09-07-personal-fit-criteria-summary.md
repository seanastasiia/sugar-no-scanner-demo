# Personal Fit criteria summary — 2026-09-07

## Scope

- Added one compact, permanently visible criteria line below `Best product` / `Best products`:
  `Sugar · Protein · Ingredients · Salt · Saturated fat · Fiber`.
- Kept the product cards and the collapsed `How scores work` explanation unchanged.
- Did not change the Personal Fit formula, weights, evidence, score bands, ranking, matching or original Sugar + Protein Fit.

## Technical checks

- `npm run check:fast` — passed: ESLint, TypeScript, 75 Vitest files and 670 tests.
- `CI=1 E2E_PORT=3017 npx playwright test tests/e2e/scanner.spec.ts --grep "personal shelf pilot is opt-in" --project="Mobile Safari"` — passed: 1 test, including the criteria copy at 320 px with no document overflow.
- `CI=1 E2E_PORT=3017 npx playwright test tests/e2e/scanner.spec.ts --grep "personal shelf pilot remains accessible" --project="Mobile Safari"` — passed: 1 test, including small-phone layout, dark mode, reduced motion, WCAG A/AA scan, 200% text and landscape overflow checks.
- `npm run build` — passed: Next.js 16.3.1 production build and standalone asset preparation.

## Product checks

1. Open a saved shelf or scan with at least one rated product, choose `View all`, and enable `Personal Shelf Rank`.
2. Confirm the six criteria appear directly below `Best product` / `Best products` and wrap cleanly on a narrow phone.
3. Confirm cards remain lightweight and `How scores work` remains collapsed until opened.
4. Compare the same shelf before and after this UI change: scores and order must be identical. Switch Personal Shelf Rank off and confirm the original Fit returns.

## Release status

Verified on branch `codex/personal-fit-criteria-summary`. Not published to production; production still requires the owner's explicit `PUBLISH` / `ПУБЛИКУЙ` confirmation.
