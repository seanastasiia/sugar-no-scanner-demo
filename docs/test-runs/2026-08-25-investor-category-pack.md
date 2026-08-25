# Investor snack and dairy category pack

- Date: 2026-08-25
- Code commit tested: `582edbb`
- Scope: packaged snacks plus dairy desserts for the Latvia investor store test

## Verified data state

`npm run catalog:validate:barbora-coverage` passed with:

- 9,707 active non-adult Barbora food SKUs;
- 7,433 exact SKUs with energy, protein and total sugar;
- 1,818 rated packaged snack SKUs;
- 255 rated dairy dessert, yogurt, sweet curd cream and glazed curd snack SKUs;
- 2,073 total SKUs in the investor category pack;
- 0 invalid records, duplicates, adult products or stale nutrition records.

The 2,073 count is source-data coverage, not a claim that every package is visually readable from every angle or shelf distance.

## Technical checks

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 22 files, 121 tests passed.
- `npm run catalog:validate:barbora-coverage`: passed with the counts above.
- `npm run build`: Next.js production build passed.
- `CI=1 npm run test:e2e`: 24 Mobile Safari scenarios passed, including the iPhone 17 Pro portrait and landscape matrix, multi-product shelf recognition, progressive enrichment and the investor-scope chooser.

Matcher fixtures verify an exact Kārums vanilla curd snack, a `ProteinFit` front sub-brand resolving to its exact BALTAIS dairy record and a classic SELGA package remaining ahead of same-brand flavored variants. An incorrect coarse aisle hint falls back to the broad catalog rather than hiding a valid non-pack result.

A four-pass production replay of the existing dense SELGA shelf returned 23 row-level identities and 9 exact rated results before the browser's cross-crop merge. It also exposed `Classic` being read as a product line alongside a specific flavor. The matcher now ignores that line only when a concrete flavor is present, penalizes conflicting `Mini`, `Treat` or `Nature` lines and keeps its exact-match margin fail-closed. Products visibly present on the shelf but absent from the current Barbora snapshot remain unrated.

## Product acceptance check

1. Open the live scanner and tap `Show demo`.
2. Confirm the chooser says `Investor test aisles` and names 2,073 rated snacks and dairy desserts.
3. In a Latvian store, first test close, front-facing packs from the snack aisle: SELGA biscuits, ĀDAŽU/ESTRELLA chips, LAIMA/KINDER sweets or protein bars.
4. Then test dairy desserts: KĀRUMS glazed curd snacks, BALTAIS ProteinFit/Skyr/yogurt or pudding/desert cups.
5. Hold the phone steady until the result is held. Confirm an exact variant shows `Great fit`, `Moderate fit` or `Low fit` plus Protein and Sugar.
6. Test two flavors from one brand and confirm the app does not borrow the first flavor's nutrition for the second.
7. Treat a remaining `Needs nutrition label` as a recognition miss to add to the benchmark, not proof that the 2,073-SKU nutrition source is missing.

## Remaining limitation

The supplied `IMG_3089.PNG` path was no longer present on disk, so that exact failed frame could not be replayed. A reliable store-readiness claim still requires a labelled set of real shelf photos for these two aisles. The current change materially narrows the promise and improves local exact matching, but it does not claim 100% computer-vision recall.
