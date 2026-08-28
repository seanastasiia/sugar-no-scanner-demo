# Camera framing and fit-overlay release check

Date: 2026-08-28

Tested code commit: `5dd47d236a133f0e2e9031c00faca9831c51bde5`

Target: Railway production, Mobile Safari-first

## Change

- The redundant `Live camera` badge is removed and the remaining camera action keeps at least 20 px of clearance above the rounded media card on phone layouts.
- Landscape and portrait gallery photos size the rounded viewport from the source image's real aspect ratio without stretching or leaving the visible viewport.
- Rated product outlines use a light semantic tint matching their green, yellow or red fit marker; packaging remains visible beneath the overlay.

## Technical verification

- `git diff --check`: passed.
- `npm run verify`: passed — ESLint, TypeScript, 166 Vitest tests and the Next.js production build.
- `CI=1 npm run test:e2e`: passed — 25/25 Mobile Safari scenarios, including iPhone 17 Pro sizing, gallery media, shelf/checkout demos, accessibility and the no-image-storage contract.

## Product verification after deploy

1. Open production in iPhone Safari and confirm the camera header no longer repeats `Live camera`.
2. Confirm `Show demo` sits clearly above the rounded camera card rather than touching it.
3. Upload one landscape and one tall portrait shelf photo; confirm each card follows the source proportions without stretching.
4. Open Shelf demo and confirm every rated package has a readable, transparent green, yellow or red tint matching its fit icon.

## Known boundary

Semantic tint is shown only for products with a grounded Sugar.no fit. Pending or unresolved detections remain neutral and are not assigned a health-looking color.
