# Carbohydrate display release — 2026-08-30

## Scope

- Add optional exact-source carbohydrates per 100 g or 100 ml across retailer, Open Food Facts, grounded-web and Supabase catalog paths.
- Show `Carbs` in compact and expanded product cards only when a source supplies the value.
- Keep Sugar.no fit, thresholds and ordering based on protein and total sugar only.
- Preserve prior accumulated exact-identity matching improvements; package size remains supporting SKU evidence but is not part of per-100 nutrition mathematics.

## Database migration

`supabase/migrations/202608300001_carbohydrate_per_100.sql` adds nullable `carbohydrate_g_100` columns without rewriting existing records. It conditionally covers the optional managed `products` table and the active retailer/Open Food Facts tables.

Applied to Supabase project `gkivwusbobnwzrisbkle`. The post-migration information-schema check returned the three active tables:

- `open_food_facts_products`
- `retailer_catalog_product_versions`
- `retailer_catalog_products`

The optional `products` table is not present in this proof-of-concept project and was intentionally skipped.

## Data boundary

The existing checked-in snapshots predate this field, so this release does not invent or backfill carbohydrates. The value appears after an exact retailer/OFF refresh or a new exact grounded nutrition result includes it. Missing values are omitted from the UI.

## Verification

Pre-publish verification on the feature working tree:

- `npm run verify`: passed.
  - ESLint: passed.
  - TypeScript: passed.
  - Unit/integration suite: 43 files, 226/226 tests passed.
  - Catalog validation: passed, including 7,433 nutrition-complete Barbora SKU records.
  - Production build: passed.
- `CI=1 npm run test:e2e`: 28/28 Mobile Safari scenarios passed.
- `git diff --check`: passed.
- Authenticated Supabase migration: passed; `carbohydrate_g_100` is present on the three active catalog tables listed above.
- The local `npm run supabase:verify:external` helper could not authenticate because the local shell intentionally has no Supabase service-role secret. Live schema and catalog counts were instead verified in the authenticated Supabase project session.

The deployed feature commit and production health result are recorded in the publish completion entry after Railway finishes.
