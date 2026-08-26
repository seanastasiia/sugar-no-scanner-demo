# Product thumbnail fallback — 2026-08-26

## Scope

Result cards prefer an exact catalog or Barbora image. When the recognized product has no stored image, the browser creates a small in-memory crop from its detection box and the current scan frame. Crops are not uploaded, persisted or added to analytics.

## Technical checks

- `npm run check:fast` — passed: ESLint, TypeScript, 25 Vitest files and 135 tests.
- `npm run verify` — passed: ESLint, TypeScript, 25 Vitest files / 135 tests and production build.
- `npx playwright test tests/e2e/scanner.spec.ts --grep "sample shelf photo highlights|checkout photo recognizes" --project="Mobile Safari"` — passed: 2/2.
- `npm run test:e2e:smoke` — passed: 4/4 critical Mobile Safari flows.
- Checkout acceptance checks require three compact and three expanded thumbnails with real pixel variation, preventing a blank gray image from passing on dimensions alone.
- Visual inspection: Shelf uses exact product images; Checkout uses recognizable crops for Sproud, Schnitzer and Stockmann products that have no catalog image.

## Release evidence

- Feature commit: pending
- Railway deployment: pending
- Production health: pending

## Owner product check

1. Open Shelf demo and confirm every compact card contains the matching package image.
2. Open Checkout demo and confirm every compact card contains a recognizable crop from the conveyor photo.
3. Tap `View all` in both demos and confirm the same images remain beside the ranked products.
4. Scan a product without a catalog image and confirm the crop comes from the held camera frame rather than a different item.
