# Architecture and file map

Use this page to locate a change without scanning the whole repository.

## Runtime flow

1. `src/components/scanner-app.tsx` owns camera state, bounded frame selection, the native barcode fast path, request cancellation, the captured-frame lock and the compact/expanded sheet.
2. `src/lib/live-camera-tracking.ts` turns tiny local luma samples into neutral pre-result candidates and helps validate the submitted frame before the recognition loop pauses. It does not identify products or move results across a new live scene.
3. `src/lib/client-image.ts` resizes and tiles saved images before upload. `src/lib/upload-scan.ts` remaps and merges tiled detections.
4. `src/app/api/recognize/route.ts` validates and rate-limits image requests.
5. `src/server/recognition.ts` asks Gemini for package identity and geometry, then resolves exact catalog records.
6. `src/server/demo-scenes.ts` supplies the deterministic Shelf and Checkout fixtures. They prove the UX, not real-world CV accuracy.
7. `src/app/api/barcode/route.ts` resolves a readable EAN/UPC against local connected-retailer and Open Food Facts layers without sending an image to Gemini.
8. `src/app/api/resolve-products/route.ts` performs the image-free enrichment pass after the first identities appear. `src/lib/enrichment-priority.ts` orders barcode/catalog-ready products ahead of unknown identities, while independent responses update cards progressively.
9. `src/server/web-nutrition-cache.ts` reads and writes the fail-open Supabase cache around the final cited-search fallback. The process cache remains the first lookup for repeated scans in one running instance.
10. `src/components/scanner-results.tsx` renders source-backed fit, per-card online purchase state and Better alternatives.
11. `src/components/personal-shelf-results.tsx` is an opt-in expanded-sheet pilot. It calls the pure versioned `src/lib/personal-shelf-rank.ts`, never the legacy Fit formula. Exact observations come from retailer/OFF adapters and `src/server/personal-shelf-parser.ts`; `/api/personal-shelf` optionally refreshes at most ten IDs from the isolated Supabase tables with a two-second deadline. This lookup never runs on the camera/legacy critical path. `scripts/sync-personal-shelf-evidence.ts` creates the small reproducible snapshot; `scripts/seed-personal-shelf-evidence.ts` is dry-run by default.
12. `/demo/personal-shelf` is a separate camera-free catalog example, reached directly or through the demo chooser. `src/server/personal-shelf-demo.ts` selects five exact existing records without I/O; only those records are passed into the client `PersonalShelfDemo`, which reuses `PersonalShelfResults` in fixed `demo` context without background evidence refresh. It has no new scan source/API mode, provider calls or mock recognition frames. The original Shelf/Checkout scene contracts remain unchanged.

## Data resolution

The exact-match ladder is:

1. curated Sugar.no catalog;
2. Barbora product and nutrition snapshots;
3. strict Rimi or Livin Latvia nutrition snapshots;
4. the Livinn Lithuania edible-identity index, which canonicalizes the exact SKU across Lithuanian, Latvian, Russian and Estonian source aliases before looking for nutrition;
5. the nutrition-complete Livinn Lithuania snapshot;
6. isolated Open Food Facts records;
7. exact cited web nutrition.

An identity-only Livinn record can name and de-duplicate a product, provide its exact GTIN to later sources and remain visible as unrated. It cannot produce a Sugar.no fit. Only a record with source-backed energy, protein and total sugar enters scoring or the alternative pool.

Shared types are in `src/lib/types.ts`. Scoring is in `src/lib/scoring.ts`. Retailer matching is in `src/server/barbora-catalog.ts` and `src/server/external-catalog.ts`. Better-alternative eligibility is isolated in `src/lib/better-alternatives.ts`.

The checked-in `data/preload-identities.latvia-demo.json` is an audited warm-up list, not a second catalog. `scripts/preload-web-nutrition.ts` is a dry-run unless `--apply` is explicit. `scripts/benchmark-recognition-models.ts` compares provider latency and returned identities without writing image bytes or paths to its report.

## Large generated files

Do not open the full files during ordinary code work:

- `data/barbora-nutrition-index.generated.json`
- `data/barbora-product-index.generated.json`
- `data/barbora-food-product-index.generated.json`
- `data/rimi-catalog.generated.json`
- `data/livin-catalog.generated.json`
- `data/livinn-food-index.generated.json`
- `data/livinn-catalog.generated.json`

Use a narrow `jq` query or the validators in `scripts/`. Generated snapshots are reproducible inputs, not hand-edited source.

## Tests

- Pure and server tests live next to the module as `*.test.ts`.
- Mobile Safari flows live in `tests/e2e/scanner.spec.ts`.
- Playwright screenshots are temporary evidence under ignored `test-results/`.
- Current release evidence is kept in only the newest relevant files under `docs/test-runs/`; older evidence remains in Git history.

## Removed paths

The old user-facing nutrition-label follow-up was unreachable after its UI action was removed. Its API mode, Gemini prompt, server module and tests were deleted in the cleanup release. Automatic exact online nutrition remains the only enrichment path.
