# Release verification: on-demand Barbora nutrition rating

- Application code commit: `377020e01c7cbd1639de47ca22d2d92c08924f1e`
- Branch: `main`
- Production URL: `https://sugar-no-scanner-demo-production.up.railway.app`
- Verification date: 2026-08-21, Europe/Riga

## Technical verification

`npm run verify`

- ESLint: pass
- TypeScript: pass
- Vitest: 12 files, 48 tests passed
- Next.js production build: pass
- Standalone assets preparation: pass

`CI=1 npm run test:e2e`

- Playwright Mobile Safari: 13/13 passed
- Exact `barbora:<slug>` identities hydrate through the product API after recognition.
- The UI exposes `Checking nutrition…` while the retailer page is loading.
- A page with energy, protein and total sugar produces a numeric `2 of 3` quick view and a colored shelf marker.
- Missing fiber is neutral `Not listed`, not a low score.
- A page without enough nutrition remains identified but receives no marker or invented result.
- The quick-view result has no automated WCAG A/AA violations.
- Existing camera, shelf, checkout, price, privacy, reduced-motion, dark-mode and enlarged-text scenarios remain green.

## Live retailer-data probe

The checked-in parser and scorer fetched the current public Barbora page for `zemesrieksti-estrella-ar-medu-140-g` and returned:

- protein: 22 g/100 g;
- total sugar: 14 g/100 g;
- fiber: not listed;
- result: `partial_nutrition`, 2 source-backed signals;
- hidden deterministic reference score: 38 (`Trade-offs` in the UI).

This proves the runtime data path on one real page. It is not a coverage estimate for all 19,076 indexed pages.

## Visual verification

- `docs/screenshots/barbora-quick-view-mobile.png`: exact Barbora product, `2/3` quick view, neutral missing fiber, source-backed note and retailer action.
- A single rated product does not call itself `Best fit in this scan`; that label now requires at least two comparable rating results.

## Product checks for the owner

1. Scan a clear food package that resolves to an exact Barbora page.
2. Confirm the compact sheet first says `Checking nutrition…` and then updates without another scan.
3. If Barbora lists energy, protein and total sugar, confirm a colored marker and `Sugar.no quick view · 2/3` appear.
4. Confirm fiber says `Not listed` and stays gray when the page does not provide it.
5. Scan a non-food item or a product page without nutrition and confirm it is identified without a Sugar.no marker.
6. Confirm the retailer page under `Data sources and limits` is the exact recognized SKU.

Real-store identity accuracy and the proportions of full, partial and unrated results remain unmeasured. The 19,076-page index must not be presented as 19,076 rated foods.
