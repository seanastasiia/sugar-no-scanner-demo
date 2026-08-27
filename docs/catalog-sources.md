# Catalog sources, licensing and refresh

Checked: 2026-08-27

This document separates product coverage from visual recognition. A catalog row can help only after the camera or barcode resolves the exact brand, variant and pack size. It is not evidence that every package on a shelf will be recognized.

## Current source ladder

| Priority | Source | Runtime role | Current checked-in scope | Redistribution rule |
| --- | --- | --- | --- | --- |
| 1 | Sugar.no curated catalog | deterministic demo and reviewed products | 40 records | Sugar.no-owned |
| 2 | Barbora Latvia | exact identity, nutrition and offer | broad checked-in food snapshot | private demo snapshot; obtain permission for production reuse |
| 3 | Rimi Latvia | exact identity, nutrition and offer | 500 complete product pages | non-redistributable retailer snapshot; obtain permission before recurring production use |
| 4 | Livin Latvia | exact identity, nutrition and offer | 6 complete food pages from the full 169-URL public sitemap | non-redistributable retailer snapshot; obtain permission before recurring production use |
| 5 | Open Food Facts | exact GTIN/name nutrition fallback | 500 complete Latvia-tagged records | ODbL database; attribution required; images have separate CC BY-SA terms |
| 6 | Cited web result | last-resort exact per-100 nutrition | runtime only | keep source URL and reject ambiguous variants |

The Rimi/Livin counts are source-backed snapshot counts, not visual-recognition or market-coverage claims. The Open Food Facts release file is a bounded Latvia subset; the same isolated schema also accepts the official daily bulk export.

## Data separation

- `retailer_catalog_products` contains non-redistributable Rimi/Livin page snapshots.
- `open_food_facts_products` contains the attributed ODbL-derived subset only.
- `catalog_sources` stores terms, attribution and redistribution metadata.
- Never publish a mixed retailer/OFF derived dump. Do not copy retailer rows into the ODbL table.
- Product images remain source URLs. Bulk image reuse needs a separate rights review.

The schema is reproducible in `supabase/migrations/202608260001_external_catalog_layers.sql`. Apply and seed it with:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npm run supabase:seed:external
```

The deployed scanner can run from checked-in snapshots when Supabase is not configured. This is intentional for the private investor proof of concept, but a scheduled managed catalog is the production target.

## Rimi and Livin refresh

The sync reads public product sitemaps and then fetches product pages slowly. It accepts a row only when exact identity, energy, protein and total sugar are present. It never estimates missing nutrition.

```bash
RETAILER_SYNC_LIMIT=500 RETAILER_SYNC_MAX_FETCHES=1000 npm run catalog:sync:rimi
RETAILER_SYNC_LIMIT=100 RETAILER_SYNC_MAX_FETCHES=800 npm run catalog:sync:livin
```

Review the generated diff for wrong brand, pack size, basis, availability, duplicate SKU and source timestamp before seeding or committing. A production refresh must run only after permission from the retailer or an approved data provider.

## Open Food Facts bulk import

The checked-in 500-row Latvia snapshot can be refreshed at a deliberately low request rate through the official structured search API:

```bash
OFF_LATVIA_LIMIT=500 npm run catalog:sync:off-latvia
```

This bounded bootstrap is for reproducible demo startup and exact local matching. It does not replace the bulk path for a production-scale refresh.

For more than a few hundred products, Open Food Facts asks reusers to use its daily CSV/JSONL exports rather than repeated API searches. The JSONL export is larger than 5 GB, so run this as a data job with durable scratch storage:

```bash
OFF_BULK_INPUT=/data/openfoodfacts-products.jsonl.gz npm run catalog:import:off
# or, in an approved data job:
OFF_BULK_INPUT=https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz npm run catalog:import:off
```

The importer streams the compressed file, keeps Latvia-tagged foods with a valid GTIN and complete per-100 energy/protein/total-sugar values, de-duplicates by GTIN and writes only the isolated OFF snapshot. It does not load the entire dump into memory.

Official references:

- [Open Food Facts API and bulk guidance](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Official JSONL dump reference](https://openfoodfacts.github.io/robotoff/explanations/interactions-product-opener/)
- [Reuse and licensing](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/)
- [Rimi Latvia sitemap](https://www.rimi.lv/e-veikals/sitemap.xml)
- [Livin Latvia product sitemap](https://www.livin.lv/sitemap/products.xml)

## Provider evaluation status

| Provider | Purpose | Status |
| --- | --- | --- |
| FatSecret Premier | localized branded-food and EAN coverage | requires provider-issued Premier evaluation credentials; no key is configured |
| NIQ Brandbank | licensed FMCG identity, images and nutrition | requires a provider-approved evaluation feed/API; no credentials are configured |
| GS1 Latvia | trusted GTIN identity attributes and access options | public Verified by GS1 is identity-only and limited; test API/feed access requires provider approval |

The exact requests and official routes are in `docs/partner-data-requests.md`. These commercial sources cannot be represented as connected until the provider issues credentials and rights for the scanner use case.
