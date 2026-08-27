# Compact online offer — 2026-08-27

## Scope

- Keep the exact camera-read shelf price and exact retailer price in one compact price line.
- Cross the shelf price only when the exact retailer SKU is cheaper.
- Replace the full-width duplicated offer block with a compact per-product action.
- Preserve a minimum 44 px touch target and the existing exact-SKU guard.

## Technical checks

- `npm run check:fast`: passed — ESLint, TypeScript and 153 unit/integration tests.
- Targeted Mobile Safari Playwright: passed — shelf comparison and honest exact-price comparison, 2/2.
- `npm run verify`: passed — ESLint, TypeScript, 153 tests and production build.
- `CI=1 npm run test:e2e`: passed — 25/25 Mobile Safari scenarios, including narrow portrait, landscape, iPhone 17 Pro, enlarged text, reduced motion and WCAG A/AA checks.
- `git diff --check`: passed.
- Local evidence: `test-results/price-cta-compact-mobile.png` and `test-results/price-comparison-mobile.png`.
- Verified code commit: `165170b3845ba04aa1df28941afc5d4700ec2db4`.
- Railway deployment `a86b926e-f34b-4f7e-ba0c-a887a8902020`: `SUCCESS`.
- Production health: `/api/health` returned `status: ok` and commit `2392931ced04d8c1b1f9bb81aa8bb3cd2dd48948`; root returned HTTP 200.

## Product checks

1. Open the Shelf demo, then tap `View all`.
2. Find a product with a lower exact Barbora offer: the shelf price must be crossed out and the lower online price shown beside it.
3. Confirm the same card has a compact `Buy cheaper · Barbora` action and no second copy of either price.
4. Open a product without a camera-read shelf price: it may say `Buy online · Barbora`, but must not show a crossed price or claim that it is cheaper.
5. Tap the action and confirm it opens the exact retailer product page.
