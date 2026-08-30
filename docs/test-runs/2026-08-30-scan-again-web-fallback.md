# Scan again and exact web-fallback release evidence

Date: 2026-08-30  
Verified revision: the release commit containing this log; production exposes its exact SHA through `/api/health`.

## Scope

- Add `Scan again` beside `View all` in the collapsed result sheet.
- Preserve a detailed Gemini `searchQuery` when the concise visible name is brand-only.
- Allow exact Open Food Facts and grounded-web fallback for a distinctive product/variant identity even when no barcode is readable.
- Keep brand-only findings fail-closed and reject a sibling dairy SKU with a different stated fat percentage.

## Technical verification

### Full verification

Command: `npm run verify`

- ESLint: passed.
- TypeScript: passed.
- Vitest: 43 files passed; 222 tests passed.
- Next.js production build: passed; standalone assets prepared.

### Full Mobile Safari browser suite

Command: `npm run test:e2e`

- Playwright WebKit: 28 of 28 tests passed in 57.1 seconds.
- Covered the public entry, camera framing, iPhone 17 Pro matrix, saved photos, progressive enrichment, captured-frame behavior, `Scan again`, exact price actions and no-image-storage safeguards.
- The dev server emitted transient `ECONNRESET: aborted` lines while Playwright replaced pages; the suite completed successfully with no failed test.

## Product verification after deploy

1. Scan a product and wait for the captured result sheet.
2. Tap `Scan again`; confirm the old result disappears and live recognition starts a new scan.
3. Open `View all`; confirm the expanded comparison has no duplicate retry button.
4. Scan `Pilos Milk 3.2% 1L`; confirm a detailed visual identity can resolve to verified protein and sugar even if its short card label is only `Pilos`.
5. Confirm a brand-only result stays unrated and a 3.2% dairy pack never borrows nutrition from a 2% sibling.
