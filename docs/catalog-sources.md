# Catalog sources, licensing and refresh

Checked: 2026-08-26

This document separates product coverage from visual recognition. A catalog row can help only after the camera or barcode resolves the exact brand, variant and pack size. It is not evidence that every package on a shelf will be recognized.

## Current source ladder

| Priority | Source | Runtime role | Current checked-in scope | Redistribution rule |
| --- | --- | --- | --- | --- |
| 1 | Sugar.no curated catalog | deterministic demo and reviewed products | 40 records | Sugar.no-owned |
| 2 | Barbora Latvia | exact identity, nutrition and offer | broad checked-in food snapshot | private demo snapshot; obtain permission for production reuse |
| 3 | Rimi Latvia | exact identity, nutrition and offer | 3 proof rows | non-redistributable retailer snapshot; obtain permission before recurring production use |
| 4 | Livin Latvia | exact identity, nutrition and offer | 2 proof rows | non-redistributable retailer snapshot; obtain permission before recurring production use |
| 5 | Open Food Facts | exact GTIN/name nutrition fallback | 5-row Latvia bootstrap | ODbL database; attribution required; images have separate CC BY-SA terms |
| 6 | Cited web result | last-resort exact per-100 nutrition | runtime only | keep source URL and reject ambiguous variants |

The Rimi/Livin counts are connection evidence, not coverage claims. The Open Food Facts release file is a smoke subset produced by the same importer used for the full daily export.

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
RETAILER_SYNC_LIMIT=50 RETAILER_SYNC_MAX_FETCHES=400 npm run catalog:sync:rimi
RETAILER_SYNC_LIMIT=50 RETAILER_SYNC_MAX_FETCHES=400 npm run catalog:sync:livin
```

Review the generated diff for wrong brand, pack size, basis, availability, duplicate SKU and source timestamp before seeding or committing. A production refresh must run only after permission from the retailer or an approved data provider.

## Open Food Facts bulk import

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
| FatSecret Premier | localized branded-food and EAN coverage | request drafted; not sent |
| NIQ Brandbank | licensed FMCG identity, images and nutrition | 200-SKU evaluation request drafted; not sent |
| GS1 Latvia | trusted GTIN identity attributes and access options | request drafted; not sent |

Drafts are in `docs/partner-data-requests.md`. Sending requires Anastasiia's approval of the final wording.
