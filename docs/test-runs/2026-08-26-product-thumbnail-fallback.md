# Product thumbnail fallback — 2026-08-26

## Scope

Result cards prefer an exact catalog or Barbora image. When the recognized product has no stored image, the browser creates a small in-memory crop from its detection box and the current scan frame. Crops are not uploaded, persisted or added to analytics.

The same release removes the redundant dark resolved-result banner above the compact sheet. Loading, offline and recoverable error feedback remain visible, and the resolved count remains available to screen readers.

The expanded comparison also removes the large duplicate `Cheaper at Barbora` panel. When an exact online SKU is cheaper, the crossed-out shelf price, Barbora price and 44 px purchase link stay inside the matching horizontal ranked card.

The shared scan limit is increased from five to ten unique high-confidence SKUs. Repeated facings still count once; the compact camera sheet previews the first four ranked products and `View all` exposes the complete result.

The live iPhone preview no longer crops the camera stream to fill a tall viewport. It uses the complete `object-fit: contain` field, while a dedicated coordinate transform keeps detection boxes aligned inside the rendered camera area. Saved images and deterministic demo scenes retain their intentional edge-to-edge crop.

## Technical checks

- `npm run check:fast` — passed: ESLint, TypeScript, 25 Vitest files and 135 tests.
- `npm run verify` — passed: ESLint, TypeScript, 25 Vitest files / 135 tests and production build.
- `npx playwright test tests/e2e/scanner.spec.ts --grep "sample shelf photo highlights|checkout photo recognizes" --project="Mobile Safari"` — passed: 2/2.
- `npx playwright test tests/e2e/scanner.spec.ts --grep "scanner follows the current Sugar.no app surface|sample shelf photo highlights|checkout photo recognizes|camera and results fit iPhone 17 Pro" --project="Mobile Safari"` — passed: 4/4 after correcting one stale test reference found by the first run.
- `npx playwright test tests/e2e/scanner.spec.ts --grep "provider unavailability pauses live recognition" --project="Mobile Safari"` — passed: 1/1; the visible recovery banner and `Try again` action remain available.
- `npx playwright test tests/e2e/scanner.spec.ts --grep "sample shelf photo highlights|honest inline retailer action" --project="Mobile Safari"` — passed: 2/2; the duplicate panel is absent and the exact Barbora link is embedded in the ranked product card.
- `npm run test:e2e:smoke` — passed: 4/4 critical Mobile Safari flows.
- `CI=1 npm run test:e2e` — passed: all 25 Mobile Safari acceptance tests, including iPhone 17 Pro portrait/landscape, reduced motion, enlarged text, dark mode, offline/provider recovery and WCAG A/AA automation.
- `npx vitest run src/lib/upload-scan.test.ts src/server/recognition.test.ts src/app/api/resolve-products/route.test.ts` — passed: 3 files / 31 tests; ten identities are accepted and an eleventh is rejected, upload merge keeps the ten highest-confidence unique products, and outbound lookup concurrency stays capped at three.
- `CI=1 npx playwright test tests/e2e/scanner.spec.ts --project="Mobile Safari" --grep "up to ten different"` — passed: 1/1; ten camera markers resolve, four compact preview cards remain visible and `View all` contains all ten ranked products.
- `npm run verify` after the ten-product change — passed: ESLint, TypeScript, 25 Vitest files / 136 tests and production build.
- `CI=1 npm run test:e2e` after the ten-product change — passed: all 25 Mobile Safari acceptance tests.
- `npx vitest run src/lib/camera-focus.test.ts` — passed: 1 file / 6 tests, including landscape-camera to portrait-stage contain mapping.
- `CI=1 npx playwright test tests/e2e/scanner.spec.ts --project="Mobile Safari" --grep "up to ten different"` after the camera change — passed: live preview reports `object-fit: contain` and the ten-product flow remains intact.
- `npm run verify` after the camera change — passed: ESLint, TypeScript, 25 Vitest files / 137 tests and production build.
- `CI=1 npm run test:e2e` after the camera change — passed: all 25 Mobile Safari acceptance tests, including iPhone 17 Pro portrait/landscape and enlarged-text coverage.
- Checkout acceptance checks require three compact and three expanded thumbnails with real pixel variation, preventing a blank gray image from passing on dimensions alone.
- Visual inspection: Shelf uses exact product images; Checkout uses recognizable crops for Sproud, Schnitzer and Stockmann products that have no catalog image.
- Visual inspection: the completed Checkout demo shows the product outlines followed directly by the compact white results sheet, with no duplicate dark count banner.
- Visual inspection: the expanded Shelf demo keeps `€3.49`, `€2.79` and `Buy cheaper at Barbora` in the first BAREBELLS card; Similar options follows immediately after the four ranked cards.

## Release evidence

- Product-image commit: `fe89fad`
- Result-banner commit: `7d151a6`
- Inline Barbora deal commit: `d88ac5a`
- Ten-product scan-limit commit: `e07f90c`
- Full-field iPhone camera commit: `07919e1`
- Railway deployment: pending
- Production health: pending

## Owner product check

1. Open Shelf demo and confirm every compact card contains the matching package image.
2. Open Checkout demo and confirm every compact card contains a recognizable crop from the conveyor photo.
3. Tap `View all` in both demos and confirm the same images remain beside the ranked products.
4. Scan a product without a catalog image and confirm the crop comes from the held camera frame rather than a different item.
5. Complete a Shelf or Checkout demo and confirm there is no dark product-count banner above the compact results sheet.
6. Confirm scanning, offline and recoverable-error feedback still appears before a successful result.
7. Expand Shelf demo and confirm the BAREBELLS deal is inside rank `#1`, the shelf price is crossed out, and no separate price panel appears below the ranking.
8. Scan a dense shelf with more than ten readable products. Confirm the compact sheet stays short, `View all` shows no more than ten unique ranked products and repeated facings appear once.
9. Open live camera on iPhone and compare it with the native Camera app at 1x. Confirm the web preview shows the complete field instead of a center crop; after recognition, each product outline must remain on its package.
