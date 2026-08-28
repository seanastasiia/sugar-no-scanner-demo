# Recognized-product retention and faster first-pass release check

Date: 2026-08-28

Target: Railway production, Mobile Safari-first

## Change

- A confidently named product stays in the scan result after online nutrition lookup finishes, even when no exact nutrition source is found.
- Products without verified protein and total sugar remain neutral: no fit marker, no camera marker and no retailer claim are invented.
- Generic anonymous findings such as `item`, `product` or price-only detections remain hidden.
- The latency-sensitive visual recognition pass now uses the dedicated `GEMINI_RECOGNITION_MODEL` override, with `gemini-3.5-flash-lite`, minimal thinking and medium image resolution as the default. Grounded nutrition and retailer verification remain a separate step.

## Regression evidence

The production request behind the reported Turtle shelf regression returned `detectionCount=10` from the recognition API, but the interface displayed only two products after enrichment. The loss happened in the client visibility filter, which previously retained only pending or fully rated products.

## Technical verification

- `git diff --check`: passed.
- Targeted Vitest: passed — 32/32 recognition-model and rating-visibility tests.
- Targeted Playwright: passed — named-but-unrated products remain visible after enrichment and after a `not_sure` completion pass.
- `CI=1 npm run test:e2e`: passed — 25/25 Mobile Safari scenarios.
- `npm run verify`: passed — ESLint, TypeScript, 169 Vitest tests and the Next.js production build.

## Product verification after deploy

1. Upload the same dense Turtle shelf photo on iPhone Safari.
2. Confirm the result keeps up to ten confidently named products instead of shrinking to the rated subset.
3. Confirm rated products remain first, while products without exact nutrition appear as neutral `Nutrition not verified online` rows.
4. Confirm unrated products do not receive green, yellow or red camera markers.
5. Confirm a truly anonymous price-only finding is not shown.
6. Compare the first `Reading visible products…` wait on the same photo with the preceding production version.

## Known boundary

This release improves retention and first-pass latency; it does not create nutrition data for an unresolved SKU. Recognition time still depends on mobile upload speed and Gemini provider latency.
