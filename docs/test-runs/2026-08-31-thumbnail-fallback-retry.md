# Thumbnail failure fallback and camera retry release evidence — 2026-08-31

## Scope

- Replace a failed retailer packshot with the matching crop from the submitted scan instead of leaving Safari's broken-image icon.
- Keep the existing aspect-correct scene-crop behavior and neutral fallback when neither image source exists.
- Replace the split uncertain-state message and retry control with one full-width `Not sure — try again` camera action.
- Keep the retry label on one line with a minimum 44 px touch target.

## Technical verification

Release changes are based on production commit `d161ff5`.

- Targeted Mobile Safari packshot-failure scenario — passed.
- Targeted Mobile Safari provider-unavailable and HTTP 429 recovery scenarios — 2/2 passed.
- `npm run verify` — passed.
  - ESLint passed.
  - TypeScript passed.
  - Vitest: 45 files, 237 tests passed.
  - Catalog validation passed: 40 curated products, 18,554 indexed Barbora records, 6,822 Rimi records, 6 Livin records and 500 Open Food Facts records.
  - Barbora automatic fit coverage remained 7,433 exact nutrition-backed products.
  - Production build passed.
- `CI=1 npm run test:e2e` — 30/30 Mobile Safari scenarios passed.
- `git diff --check` — passed.

## Product verification

1. Open a captured result containing a product whose retailer image does not load.
2. Confirm the card shows that product's crop from the captured scene, not a question-mark or broken-image icon.
3. Confirm the crop remains proportional and may include a small amount of neighboring shelf context.
4. Trigger an uncertain or temporarily unavailable camera result.
5. Confirm the bottom pill is one full-width `Not sure — try again` button on one line and tapping it starts a fresh scan.

## Boundaries

- The fallback crop uses only the in-memory submitted scene already displayed to the user; it is not written to Supabase, analytics or logs.
- If neither a usable packshot nor a scene crop exists, the UI keeps the neutral scan placeholder and does not invent an image.
