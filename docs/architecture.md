# Architecture and file map

Use this page to locate a change without scanning the whole repository.

## Runtime flow

1. `src/components/scanner-app.tsx` owns camera state, request cancellation, result locking and the compact/expanded sheet.
2. `src/lib/client-image.ts` resizes and tiles saved images before upload. `src/lib/upload-scan.ts` remaps and merges tiled detections.
3. `src/app/api/recognize/route.ts` validates and rate-limits image requests.
4. `src/server/recognition.ts` asks Gemini for package identity and geometry, then resolves exact catalog records.
5. `src/server/demo-scenes.ts` supplies the deterministic Shelf and Checkout fixtures. They prove the UX, not real-world CV accuracy.
6. `src/app/api/resolve-products/route.ts` performs the image-free enrichment pass after the first identities appear.
7. `src/components/scanner-results.tsx` renders source-backed fit, per-card online purchase state and Better alternatives.

## Data resolution

The exact-match ladder is:

1. curated Sugar.no catalog;
2. Barbora product and nutrition snapshots;
3. strict Rimi or Livin page snapshots;
4. isolated Open Food Facts records;
5. exact cited web nutrition.

Shared types are in `src/lib/types.ts`. Scoring is in `src/lib/scoring.ts`. Retailer matching is in `src/server/barbora-catalog.ts` and `src/server/external-catalog.ts`. Better-alternative eligibility is isolated in `src/lib/better-alternatives.ts`.

## Large generated files

Do not open the full files during ordinary code work:

- `data/barbora-nutrition-index.generated.json`
- `data/barbora-product-index.generated.json`
- `data/barbora-food-product-index.generated.json`
- `data/rimi-catalog.generated.json`
- `data/livin-catalog.generated.json`

Use a narrow `jq` query or the validators in `scripts/`. Generated snapshots are reproducible inputs, not hand-edited source.

## Tests

- Pure and server tests live next to the module as `*.test.ts`.
- Mobile Safari flows live in `tests/e2e/scanner.spec.ts`.
- Playwright screenshots are temporary evidence under ignored `test-results/`.
- Current release evidence is kept in only the newest relevant files under `docs/test-runs/`; older evidence remains in Git history.

## Removed paths

The old user-facing nutrition-label follow-up was unreachable after its UI action was removed. Its API mode, Gemini prompt, server module and tests were deleted in the cleanup release. Automatic exact online nutrition remains the only enrichment path.
