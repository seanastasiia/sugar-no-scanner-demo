# Accumulated UI publish check

Date: 2026-08-28

Tested code commit: `e2c3f654870db5029f286bb642d6c129e0ccedcd`

Target: Railway production, Mobile Safari-first

## Change

- Product and alternative cards show a purchase action only when an exact online offer is strictly cheaper than the camera-read shelf price.
- The qualifying action is one full-width green `Buy cheaper online` button; generic online CTAs are omitted.
- The live camera card follows the real stream aspect ratio so the rounded frame has no artificial black bands above or below the image.
- Rimi and Livin snapshot image hosts are allowed by Next.js and guarded by a catalog-host regression test.

## Technical verification

- Focused retailer-image Vitest: passed — 1/1.
- Targeted Mobile Safari Playwright scenarios: passed — 3/3 (Shelf demo, live camera geometry and price comparison).
- `npm run verify`: passed — ESLint, TypeScript, 163 Vitest tests and Next.js production build.
- `CI=1 npm run test:e2e`: passed — 25/25 Mobile Safari scenarios.
- `git diff --check`: passed.

## Product verification after deploy

1. Open production on an iPhone and confirm the live image reaches the rounded camera card's top and bottom edges without black bands.
2. Open Shelf demo and expand `View all`.
3. Confirm a full-width green `Buy cheaper online` action appears only where the exact online price is lower than the visible shelf price.
4. Confirm cards with no shelf price, the same price, or a higher online price have no purchase button.
5. Confirm exact Rimi and Livin matches show their product images rather than a broken-image icon.

## Known boundary

Allowlisting a retailer host cannot repair a stale or removed source image URL. Such rows continue to use the scanned-photo fallback instead of inventing a packshot.
