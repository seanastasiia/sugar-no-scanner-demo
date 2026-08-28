# Final release audit

Date: 2026-08-29

Base revision: `8469c1dd038ee57c173704acded6d95fdd7bff7e`

Target: private Railway investor demo, iPhone Safari-first

## Release scope

- Restores access-code protection with a 12-hour HTTP-only, same-site session while keeping the scanner itself free of a `Private demo` badge.
- Rejects unauthenticated API use, cross-origin browser writes, oversized payloads and repeated public-demo requests; health and access remain public.
- Keeps frames ephemeral and corrects the privacy copy: frames are sent to Google Gemini for recognition and are not stored by Sugar.no.
- Preserves exact-SKU nutrition guardrails across curated, Barbora, Rimi, Livin, Open Food Facts and cited grounded-web layers.
- Improves multilingual retailer identity matching and deterministic duplicate selection without relaxing brand, variant or pack-size checks.
- Keeps `gemini-3.5-flash` as the measured recognition default and adds a bounded 15-second provider timeout.

## Catalog evidence

`npm run catalog:validate` passed with:

- 40/40 curated products with complete protein and total-sugar data;
- 18,554 unique Barbora discovery records;
- 6,822 complete Rimi rows from 7,617 pages in the seven approved categories;
- 6 complete Livin rows from its 169-URL Latvia sitemap;
- 500 complete Latvia-tagged Open Food Facts records in the isolated ODbL layer.

## Model benchmark

Five saved real-shelf images were compared with the full production schema. `gemini-3.5-flash` averaged 7.105 seconds and returned 38 unique product identities. A lean response schema was faster but returned fewer and less stable products, so it was rejected. This set is not hand-labelled, so it cannot support a recall or accuracy claim. The new timeout prevents an indefinite pending state but the `<4 s` p95 target is not yet accepted.

## Local technical verification

- Access-form hydration regression: 10/10 consecutive Mobile Safari runs passed.
- `CI=1 npm run test:e2e`: 28/28 Mobile Safari scenarios passed, including iPhone 17 Pro/Pro Max, narrow portrait, landscape, Android-sized phones, tablet, 200% text, dark/reduced-motion, privacy and accessibility.
- `npm run verify`: ESLint passed; TypeScript passed; 35 Vitest files and 194 tests passed; Next.js production build passed.
- `npm run catalog:validate`: passed with the catalog counts above.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `git diff --check`: passed.

## Security review

No P0 issue remained. The cost/privacy risk from public Gemini endpoints was closed with the access gate and authenticated API proxy. Strict source matching still fails closed when nutrition or an exact retailer identity cannot be proven. Retailer data reuse remains private-demo-only pending permission.

## Product verification after deployment

1. Open production in iPhone Safari and enter the existing demo access code.
2. Allow camera access and confirm the scanner opens without an internal private-demo badge.
3. Point at a clear shelf, hold still and confirm up to ten distinct products remain visible while nutrition enrichment runs in the background.
4. Open Shelf demo and Checkout demo; confirm fit markers, ranking, thumbnails and cheaper-online actions behave independently per product.
5. Confirm an unknown or ambiguous product stays neutral rather than receiving invented nutrition.
6. Re-open after a refresh and confirm the session remains valid; use a private tab to confirm unauthenticated access returns to the code page.

## Known boundaries

- Physical-store recall, unsupported false positives and shelf-price association still require a labelled store benchmark.
- The selected cloud model is not yet QR-speed; the current five-image benchmark is above the target latency.
- Retailer snapshots are reproducible discovery data, not real-time stock or price guarantees.
- Products without exact source-backed protein and total sugar remain unrated by design.

Production deployment identifiers and health checks are appended after Railway verifies the final GitHub revision.
