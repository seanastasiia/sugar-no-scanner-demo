# Remove `Barbora online` from compact prices

Date: 2026-08-28

Candidate commit: `4ff6234ef634ae7b0b859caf13435511fb0b33c6`

## Technical checks

- `npm run verify`: passed.
  - ESLint: passed.
  - TypeScript: passed.
  - Vitest: 29 files, 153 tests passed.
  - Next.js production build: passed.
- `npx playwright test tests/e2e/scanner.spec.ts --grep "sample shelf photo highlights|a rated product receives an honest price comparison"`: 2 Mobile Safari tests passed.
- Regression assertions confirm that no compact price has visible or accessibility text containing `Barbora online`; retailer-neutral labels use `Online price €…`.
- Railway CLI deployment `8b004b85-7129-4c9d-8ceb-0caec36636aa`: `SUCCESS`; the subsequent GitHub-main deployment is the production source-of-truth check.

## Product check

1. Open Shelf demo on an iPhone and inspect the compact cards below the camera.
2. Confirm an online-only offer shows just its price, for example `€2.79`.
3. Confirm the words `Barbora online` do not appear beside that price.
4. Open `View all` and confirm the purchase action still opens the exact retailer SKU.

## Expected limitation

The retailer name remains in the purchase link's accessible destination label so assistive-technology users know where the external link opens. It is not displayed in the compact price row.
