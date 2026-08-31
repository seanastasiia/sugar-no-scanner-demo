# Cross-retailer alternatives release evidence — 2026-08-31

## Scope

- Build `Better alternatives` from the complete verified nutrition pool: Sugar.no, Barbora, Rimi, Livin and the licensed Open Food Facts snapshot.
- Keep alternatives strict: the same exact product type and form, `Great fit`, and no worse fit than the selected item.
- Show a purchase action only when an exact connected-retailer offer exists for that SKU.
- Label an offer as cheaper only when a camera-read shelf price exists and the exact online price is strictly lower.
- Keep nutrition ranking independent from retailer price and availability.

## Source and offer boundaries

- Verified nutrition records can contribute to scoring and same-type comparison.
- Open Food Facts records without a connected retailer offer cannot become purchase cards.
- Barbora offers are resolved by exact product slug.
- Rimi and Livin offers are resolved by exact imported source product ID.
- No brand-only, title-only, or approximate retailer offer is presented as an exact online price.

## Technical verification

Feature commit: `8e372fb`

- `npm run verify` — passed.
  - ESLint passed.
  - TypeScript passed.
  - Vitest: 45 files, 234 tests passed.
  - Catalog validation passed: 40 curated products, 18,554 indexed Barbora records, 6,822 Rimi records, 6 Livin records, 500 Open Food Facts records.
  - Barbora automatic fit coverage: 7,433 exact nutrition-backed products.
  - Production build passed.
- `CI=1 npm run test:e2e` — 29/29 Mobile Safari scenarios passed.
- Targeted sample-shelf scenario passed, including generic exact online offers and strict cheaper-price behavior.
- `git diff --check` — passed.

The release commit is a documentation-only child of the feature commit. Production health is checked against the final deployed SHA after Railway deployment.

## Product verification

1. Open the shelf demo and select a rated product.
2. Open `Better alternatives`; any shown alternative must be the same exact product type, `Great fit`, and available from a connected retailer.
3. Confirm that alternatives may come from different connected retailers when their exact offers exist.
4. For a product without a camera-read shelf price, confirm that no struck-through price and no `cheaper` claim appears.
5. For an exact online offer below the camera-read shelf price, confirm that the shelf price is struck through and `Buy cheaper online` appears.
6. For an item with no qualifying exact alternative, confirm that the `Better alternatives` section is absent.

## Known limits

- Retailer snapshots can become stale and must be refreshed by their import jobs.
- Open Food Facts expands nutrition coverage but does not prove Latvia availability.
- Exact SKU evidence remains mandatory; the app does not invent nutrition or online prices.
