# Two-factor Sugar.no fit release evidence

Date: 2026-08-24 (Europe/Riga)

Code and product-documentation SHA before this evidence-only commit: `3abe65a93480feba1c1e1ded4f8b5da1117c8c29`.

## Change

- Sugar.no fit now uses equal-weight protein and inverse total sugar only.
- Fiber remains in raw catalog/source records for compatibility, but is absent from criterion scores, the badge, completeness rules and investor-facing product copy.
- All 40 curated Latvia products have both required factors.
- An exact Barbora food receives a fit only when energy, protein and total sugar are source-backed; one-factor and identity-only products remain neutral.
- Retailer CDN image waits were removed from deterministic browser acceptance so an external image host cannot block product-flow CI.

## Technical checks

| Check | Result |
| --- | --- |
| `npm run verify` | Pass: ESLint, TypeScript, 16 Vitest files / 80 tests, Next.js production build and standalone asset preparation |
| `npm run catalog:validate` | Pass: 40 rows, 40 complete two-factor records, 10 records with optional raw fiber, 19,076 Barbora slugs |
| `npx playwright test --list` | Pass: 18 authored Mobile Safari scenarios discovered |
| GitHub Mobile Safari run #8 | Found one real 4.34:1 compact-name contrast defect and one cold-hydration flake; both fixes were added before the final rerun |
| Local Playwright execution | Not run: the managed QA sandbox cannot bind the required local web server; GitHub WebKit is the browser release gate |

## Product checks after deploy

1. Open the Shelf demo and expand `View all`.
2. Confirm every rated card shows only Protein and Sugar; Fiber must be absent.
3. Confirm the four markers still use `Great fit`, `Moderate fit` or `Low fit` and the leading comparable product retains `Best fit in this scan`.
4. Scan an exact Barbora food with energy, protein and total sugar. Confirm it receives `Sugar.no fit`, not `2/3` or a partial badge.
5. Check a protein-only or sugar-only fixture. It must remain a neutral limited view with no camera marker or overall fit.

Railway deployment, production health and GitHub WebKit results are recorded after this evidence file reaches `main`.
