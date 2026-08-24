# Ranked scan results release check

- Date: 2026-08-24, Europe/Riga
- Feature commit: `f5eb48317e13116b2b317ac2cfd8c1759e727ead`
- Scope: order multi-product results from higher to lower verified Sugar.no fit and leave unrated identities at the end without a fabricated rank.

## Technical checks

| Check | Result |
| --- | --- |
| `npm run verify` | Pass: ESLint, TypeScript, 16 Vitest files with 81 tests, Next.js production build and standalone asset preparation |
| `E2E_PRODUCTION=1 npx playwright test --project='Mobile Safari'` | Pass: 18 of 18 scenarios |
| Ranking unit regression | Pass: rated scores sort descending, ties preserve scan order, duplicates collapse and unrated items remain last |
| Shelf result | Pass: four rows render as `#1` through `#4`, with visible `Great / Moderate fit` and Protein/Sugar values |
| Checkout result | Pass: Sproud, Schnitzer and Stockmann render as `Fit pending`, with no rank number or invented fit |
| Accessibility/responsive | Pass: automated WCAG A/AA check, 375 px portrait, phone landscape, dark mode, reduced motion and 125% text scenario |
| `git diff --check` | Pass |

One full production-mode run exposed an existing fixed-delay race in the shelf-completion test. The regression now polls for the actual second request for at most five seconds. The final complete run passed all 18 scenarios.

## Visual evidence

- `docs/screenshots/shelf-mobile.png`: compact best-first preview.
- `docs/screenshots/shelf-results-mobile.png`: expanded vertical rated ranking.
- `docs/screenshots/checkout-mobile.png`: compact real checkout result.
- `docs/screenshots/checkout-results-mobile.png`: expanded unrated checkout list.

## Production check

Pending GitHub `main`, Railway deployment and public health/UI smoke at the time this record was created.
