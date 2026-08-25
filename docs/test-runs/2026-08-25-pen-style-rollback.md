# Pen styling rollback release evidence

Date: 2026-08-25
Rollback implementation commit: `91db6491226c1d49fdbaecdb30853fd751b53da5`
Restore reference: `pre-pen-style-2026-08-25` (`62f62bf8a3b626d2ac65064a7c98b92ee28c1ab6`)

## Scope

- Restored `src/app/globals.css` and `src/components/scanner-app.module.css` exactly to the pre-Pen restore reference.
- Kept `design/sugar-no-scanner.pen` as an inactive design artifact; it no longer defines or changes production styling.
- Restored the checkout evidence screenshots captured by the Mobile Safari suite.
- Updated README, design-study status and `Bugs.md` so the rejected experiment cannot be mistaken for the current production design.
- Recognition, catalog, nutrition, pricing and analytics logic were not changed.

## Technical checks

Executed from `/Users/anastasiia/Documents/ChatGPT/sugar-no-scanner-demo` against the rollback implementation content.

| Check | Result |
| --- | --- |
| `git diff --exit-code pre-pen-style-2026-08-25 -- src/app/globals.css src/components/scanner-app.module.css` | Passed; no CSS difference from the restore point |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed; 22 files and 121 tests |
| `npm run build` | Passed; Next.js production build and standalone asset preparation completed |
| `CI=1 npm run test:e2e` | Passed; 24/24 Mobile Safari scenarios in 55.2 s |

The browser suite covered camera entry, shelf and checkout demos, saved photos, long retailer screenshots, fit hydration, price comparison, privacy rejection, camera recovery, responsive layouts including iPhone 17 Pro, enlarged text, reduced motion and automated WCAG A/AA checks.

## Product verification

1. Open production on an iPhone and confirm the familiar cream/black investor-demo styling is back.
2. Open Shelf and Checkout samples and confirm recognition cards and bottom-sheet interactions still work.
3. Expand `View all`, collapse the comparison and run `Scan again`.
4. Confirm the Figma/Pen visual experiment is not visible anywhere in the deployed scanner.

## Remaining notes

- The editable Pen experiment remains committed only for possible future design exploration.
- Any future design-system experiment should be reviewed as a preview before production CSS is changed.
