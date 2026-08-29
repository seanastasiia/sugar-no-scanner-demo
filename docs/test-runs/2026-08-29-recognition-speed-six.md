# Recognition speed, cache and barcode release evidence

Date: 2026-08-29  
Branch base: `8feb016e16a143d8c309099b86b40694bad934b0`

## Delivered package

1. Persistent, server-only Supabase cache for exact cited nutrition: 30-day success TTL and six-hour miss TTL.
2. Dry-run-first preload tooling plus a versioned ten-SKU Latvia demo list.
3. EAN/UPC fast path through native browser barcode detection and the local retailer/Open Food Facts layers; Gemini barcode output uses the same resolver on Safari.
4. Progressive enrichment ordered by exact barcode/catalog evidence, with five independent requests.
5. Reproducible recognition-model benchmark with no image bytes or paths in its JSON report.
6. Faster live sampling: 550 ms autofocus settle, 350 ms quality checks, compact 1152 px JPEG at quality 0.74, and a continuously playing preview.

## Model benchmark

Input scenes: the checked-in Latvia shelf and checkout fixtures. One run per scene/model; this is a latency/yield comparison, not labeled ground-truth accuracy.

| Model | Shelf | Checkout | Combined |
| --- | ---: | ---: | ---: |
| Gemini 3.5 Flash | 8 products / 5,972 ms | 4 / 3,437 ms | 12 / 9,409 ms |
| Gemini 3.7 Flash | 8 products / 4,178 ms | 3 / 5,692 ms | 11 / 9,870 ms |

Decision: keep `gemini-3.5-flash` as the dedicated recognition default. The newer candidate returned one fewer identity and was 461 ms slower across the two calls. `gemini-3.7-flash` remains available for cited nutrition search, where the task is different.

## Scoped checks completed during implementation

- Cache tests: hit, miss, expiry and fail-open behavior.
- Barcode tests: connected retailer and isolated Open Food Facts exact resolution.
- Priority tests: exact identities sort before remote-search candidates without losing stable order.
- Frame-quality tests: sharp edges pass and flat/blur-like frames stay below threshold.
- Recognition tests: explicit benchmark model override reaches the provider request path.
- Latvia preload dry-run: ten audited candidates parsed without network writes.

## Full local verification

Implementation commit: `2fba4c60bdb5c456ffe168f2f1d98b82b46b1b35`.

- `npm run verify`: passed — lint, TypeScript, 39 test files / 206 tests, and the production build.
- `npm run test:e2e:smoke`: passed — 3/3 Mobile Safari smoke scenarios.
- `npm run test:e2e`: passed — 28/28 Mobile Safari scenarios.
- `git diff --check`: passed.
- `npm run catalog:preload:nutrition -- --input data/preload-identities.latvia-demo.json`: passed in dry-run mode for 10/10 identities.

## Supabase activation

- Project: `sugar-no-scanner-demo` (`gkivwusbobnwzrisbkle`), Central EU (Frankfurt).
- `web_nutrition_cache` migration applied; RLS is enabled and table privileges are restricted to the server-side service role.
- Applied Latvia preload: ten exact identities persisted as six cited successes and four honest misses.
- Cached misses: Turtle Bran Flakes Organic 375 g, Turtle Cocoa Pillows Hazelnut Filling 300 g, Maggi Sātīgais vistas buljons 120 g and Oyakata Japanese Soy Sauce Noodles 89 g. No nutrition was guessed for them.
- Immediate repeat completed in 2.23 seconds including Railway CLI startup, returned the same ten cached outcomes and emitted no nutrition-provider fallback log.

GitHub push, Railway deployment and production health evidence are recorded below only after the complete release succeeds.

## Product checks after deployment

1. Scan a known barcode on a supported browser; the exact product should appear without waiting for visual identity search.
2. Scan a mixed shelf; known/rated cards should finish before unfamiliar products, and each card should update independently.
3. Scan the same exact unfamiliar SKU twice; after the first verified lookup, the second should return from cache without repeating cited search.
4. Open live camera and hold steady; sampling should start in under one second, the stream should remain moving, and a soft startup frame should not be submitted.
5. Move after a result: understand that this prototype holds the overlay until the next scan and does not claim native AR tracking.

Final commit, full verification, Supabase migration/preload, GitHub push, Railway deployment and production health evidence are appended only after the complete six-part package is released.
