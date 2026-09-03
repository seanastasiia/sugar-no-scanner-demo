# Personal Fit whole-catalog audit — 2026-09-03

Scope: offline accounting foundation for the isolated Personal Rank preview branch. This is not a production release and not a recognition benchmark.

## Baseline result

- Accounted source inventory: 19,524 records with 19,524 distinct source IDs.
- Separate curated/reference rows: 40.
- Existing source observations: 1,533; every observation belongs to one inventory source ID, with no duplicate observation ID.
- Current outcomes: 287 scored, 925 provisional, 860 supported but missing essential evidence, 17,452 unsupported; 1,212 assessable in total.
- Current source rows: Barbora 9,707; Rimi 6,822; Livinn Lithuania 2,489; Livin Latvia 6; Open Food Facts Latvia 500.
- Deduplication review: no usable cross-source GTIN group; 275 equal reviewed-alias + brand + pack candidates across sources; 2,199 present identifiers fail supported GTIN length/checksum validation and are excluded from barcode grouping.
- Global unique-product count deliberately remains unknown. Candidate groups are not merged and do not share nutrition.

Largest unsupported areas include 2,274 Barbora identities without a nutrition/category row, 192 OFF rows without a category, tea (154), carbonated soft drinks (128), single ice creams (122), fermented cheese (119), jelly sweets (118), sweets (116), boxed chocolates (109) and herring products (108). This list is a prioritisation input, not permission to apply one score model across types.

## Technical checks

- `npm test -- src/server/personal-shelf-audit.test.ts`: 7 passed.
- `npm run typecheck`: passed.
- `npm run catalog:audit:personal-fit -- --write`: passed and wrote the ignored detailed report `.catalog-sync/personal-fit-catalog-audit.json`.

The detailed report includes SHA-256 for every checked-in input so a later run can identify data drift. The command makes no network/model/provider/database call and does not alter application catalog snapshots.

## Product checks for the owner

1. Treat 19,524 as source records, not unique foods and not 19,524 available scores.
2. Review representative candidates across two stores: identical name/brand/pack may be a translation match, but nutrition must remain attached to its original page until exact variant identity is proven.
3. Confirm that missing values, unsupported types and rejected barcodes remain neutral/unranked in the preview.
