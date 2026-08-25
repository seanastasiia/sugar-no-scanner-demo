# Broad Latvia catalog coverage release check

- Date: 2026-08-25, Europe/Riga
- Catalog commit: `809a1de8268dbec4bc88f79e292ae871651d4eee`
- Visual confirmation commit: `1922b167c22ea83a1176d744a46ea8e9856a2932`
- Price-decoupling release commit: `816c8a1b1f791bc269ce89c89ec8ab60179659f3`
- Scope: replace the misleading 40-SKU coverage claim with a versioned broad Barbora food snapshot, strict exact-SKU matching and a constrained visual confirmation pass.

## Catalog result

| Measure | Result |
| --- | ---: |
| Current Barbora sitemap product pages | 18,554 |
| Active non-adult food SKUs enumerated from the grocery sections | 9,707 |
| Exact SKUs with source-backed energy, protein and total sugar | 7,433 |
| Automatic-fit coverage inside the active food index | 76.57% |
| Brands represented in the nutrition snapshot | 817 |
| Categories represented in the nutrition snapshot | 276 |

The 40 curated protein snacks remain a deterministic category benchmark. They are no longer the runtime coverage boundary. The scanner first checks the curated record, then the broad local Barbora snapshot, then a strict Open Food Facts result. Gemini never generates nutrition.

## Technical checks

| Check | Result |
| --- | --- |
| `npm run verify` | Pass: ESLint, TypeScript, 19 Vitest files with 103 tests, Next.js production build and standalone asset preparation |
| `CI=1 npm run test:e2e` | Pass: 19 of 19 Mobile Safari scenarios in 54.9 seconds |
| Catalog coverage validator | Pass: 9,707 active food products and 7,433 complete two-factor nutrition records |
| Exact-SKU trust boundary | Pass: brand, distinctive variant tokens, multilingual equivalents, pack/multipack size and runner-up margin are checked |
| Constrained visual confirmation | Pass: only a supplied candidate slug at confidence 0.92 or higher is accepted; invented and low-confidence slugs are rejected |
| Nutrition/price independence | Pass: an exact local snapshot identity keeps its fit if the live Barbora price page is unavailable; price and CTA remain hidden |
| Privacy contract | Pass: every public shelf request reports `imageStored: false`; the benchmark artifact contains metadata only |
| `git diff --check` | Pass |

## Real-image production benchmark

[GitHub Actions run 32792037831](https://github.com/seanastasiia/sugar-no-scanner-demo/actions/runs/32792037831) passed on release commit `816c8a1b1f791bc269ce89c89ec8ab60179659f3`.

| Run | Total rated | Close mayonnaise shelves rated | Average provider / round trip |
| --- | ---: | ---: | ---: |
| Pre-expansion baseline `32781804241` | 5 / 20 (25%) | 4 / 12 (33%) | 4,623 / 5,559 ms |
| Broad-index first release `32790159980` | 2 / 20 (10%) | 2 / 10 (20%) | 3,568 / 4,742 ms |
| Final release `32792037831` | 6 / 21 (28.57%) | 5 / 11 (45.45%) | 3,768 / 4,744 ms |

The first broad-index deployment exposed a real bug: exact nutrition was coupled to a live retailer price-page response, so eligible products could fall back to `Identified`. The final release separates those trust paths and recovers the fit without inventing a current price.

All five public cases completed without request failures, duplicate identities or stored images. One distant checkout stress image returned no detections on the final run. The alcohol aisle correctly remained unrated because the snapshot deliberately excludes adult products. Private labels absent from Barbora also remain neutral unless an exact Open Food Facts record or a readable package nutrition table is available.

This public set is not ground-truthed and Gemini output is nondeterministic, so the 28.57% figure is a reproducible smoke result, not an accuracy guarantee. The two close mayonnaise frames are the only shelf-distance food cases suitable for product-value interpretation.

## Production release

- Direct Railway deployment `fd5c46da-b76b-492e-af81-91f0af64ad5f` completed successfully.
- `/api/health` returned `status: ok`, commit `816c8a1b1f791bc269ce89c89ec8ab60179659f3`, `activeFoodProducts: 9707` and `productsWithAutomaticFit: 7433`.
- `/api/products/barbora%3Amajoneze-siera-spilva-250-g` returned a complete Barbora-backed fit with Protein 2.7 g, Sugar 4.9 g and four same-category alternatives.

## Product check after deployment

1. Scan close shelves in sauces, dairy and snacks, holding the phone roughly 0.5–1.5 m away for one to two seconds.
2. Confirm exact Barbora products show Protein, Sugar and `Great fit`, `Moderate fit` or `Low fit`; current price appears only when its live page succeeds.
3. Show two same-brand variants or sizes. Confirm a fit appears only when the exact package is distinguishable; an unreadable variant must ask for its nutrition label.
4. Scan a Rimi/Lidl/Stockmann private label absent from Barbora. Confirm Sugar.no offers `Scan nutrition label` instead of inventing a fit.
5. Scan the package barcode or the per-100 nutrition table and confirm a source-labelled fit replaces the pending identity when the evidence is complete.

## Next coverage gate

Before claiming broad Latvian-store recognition, capture and ground-truth at least 200 real products across Rimi, Maxima, Lidl, Stockmann and Barbora shelves. Measure exact-SKU precision, rated coverage, false positives and p95 latency by retailer/category. The next data expansion should ingest first-party product feeds or permitted catalogs from retailers whose private labels are absent from Barbora; it must not relax the current exact-SKU threshold.
