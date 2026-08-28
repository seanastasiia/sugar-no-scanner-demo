# Aspect-correct product thumbnail release check

Date: 2026-08-28  
Tested code commit: `4b1c23b`  
Target: Railway production, Mobile Safari-first

## Change

- Exact retailer packshots continue to use `object-fit: contain`.
- When an exact packshot is unavailable, the preview expands the detected shelf area by 1.6× and matches the target card aspect ratio in source-image pixels.
- The package is never stretched to fill the portrait thumbnail; neighboring packages or shelf background may remain visible.

## Technical verification

- `npm run check:fast`: passed — ESLint, TypeScript and 155 Vitest tests.
- Targeted checkout Playwright scenario: passed — 1/1 Mobile Safari scenario.
- `npm run verify`: passed — ESLint, TypeScript, 155 Vitest tests and Next.js production build.
- `CI=1 npm run test:e2e:smoke`: passed — 4/4 Mobile Safari scenarios.
- `git diff --check`: passed.

## Visual evidence

- `test-results/checkout-mobile.png`: inspected locally; compact thumbnails retain the checkout-photo geometry and include neighboring groceries.
- `test-results/checkout-results-mobile.png`: inspected locally; expanded ranked thumbnails preserve the same proportions without a tight stretched crop.

## Product verification after deploy

1. Open production on an iPhone and scan a shelf product without an exact retailer packshot.
2. Check the compact preview below the camera and the expanded `View all` list.
3. Confirm the product is not visually stretched; neighboring products or shelf background are acceptable.
4. Confirm exact retailer packshots still fit inside the same thumbnail surface without cropping.

