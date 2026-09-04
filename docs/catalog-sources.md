# Catalog sources, licensing and refresh

Checked: 2026-09-04

## Bounded preview expansion

The first regional import uses `python3 scripts/extract-off-regional-csv.py --apply`: a version-pinned official CSV stream of 1,275,171,186 compressed bytes, with only selected regional product fields saved. Its dry-run prints the exact S3 version and limits. This avoids thousands of small Parquet range requests. The archive is not saved. CSV lacks reliable ingredient-language and translated-name fields; the importer preserves that absence and does not invent aliases or Personal Fit eligibility. The original 500-record layer remains byte-for-byte unchanged.

The 4 September run completed in 1,020 seconds: 4,535,553 rows scanned, 15,669 regional rows, no malformed rows, 500 existing GTINs and **596 accepted new GTINs**. Rejected: 88 invalid GTINs, 3,715 missing brands, 8,178 unknown package dimensions, 2,385 missing core values/name, 204 source-quality flags and 3 contradictory tables. There were no conflicting duplicate GTINs. The report is `data/open-food-facts-regional-import-report.generated.json`. Bulk import alone adds no Personal Fit score: 136 records have supported categories but incomplete scoring evidence, and 460 are outside current profiles. A separate exact-response follow-up may improve that evidence; the raw CSV snapshot is retained separately.

The daily `export_database.pl` file is sanitized TSV, with literal quote characters, not quote-delimited CSV. `scripts/off_tsv.py` uses `QUOTE_NONE` and rejects rows with a different column count; `python3 scripts/test_off_tsv.py` verifies literal quotes, malformed rows and schema rejection. An exploratory standard-CSV parse was rejected without importing its partial file. Category tags exclude identified pet/non-food records.

`npx tsx scripts/follow-up-off-evidence.ts plan|dry-run|run|report|promote` freezes up to 50 supported incomplete original OFF cards with a valid barcode and known package size. It uses exact OFF v3 product reads, one worker and a 4.1-second minimum gap after each response. Brand, a source-provided name/alias and package dimension/size must still agree. Inequality modifiers stay unknown. HTTP 403, 429 or OFF global-limit 503 stops the queue and records the retry boundary. Promotion changes only successful selected observations, preserves concurrently appended other IDs, and refuses changed target evidence. No search/model calls or paid provider is used.

Add `--regional` for the new bulk layer only: at most 150 incomplete supported IDs (136 in this run), with a separate frozen cohort and inherited source cooldowns. A follow-up is not permission to invent translated names or apply a score to an unsupported category.

Final follow-ups: original cohort 50 attempted / 48 accepted / 19 new assessments in 262 seconds; regional cohort 136 attempted / 124 accepted / 43 new assessments in 601 seconds. No rate-limit refusal occurred in these two queues, and no paid-provider call was made. OFF now contributes 78 assessments from 1,096 source records. Whole newer observations live in `personal-shelf-off-evidence.generated.json`, separate from the raw bulk and original basic snapshots. An unknown or unsupported ingredient language stays unknown after the follow-up too.

The Parquet extractor below remains an optional richer-source route. Its 4,615 small row groups made full remote scanning unsuitable for this local batch; exploratory runs were stopped without promoting partial files. `--gtin-prefixes 475,477,481` can scope a batch, but never substitutes prefixes for market tags and does not guarantee fewer requests on unsorted row groups.

Exact retailer refresh is scoped by `SHELF_BATCH_IDS_FILE` with isolated checkpoint/output paths. The frozen 200-ID pilot and 307-ID category review are documented in `docs/personal-fit-expansion-plan.md`. HTTP 403/429 stop that source until its recorded retry boundary. New values must come from the same exact SKU page; a changed SKU or variant is not repaired by copying another market's nutrition.

The [OFF-owned Parquet export](https://huggingface.co/datasets/openfoodfacts/product-database) offers an alternative to downloading the full JSONL database. `scripts/extract-off-regional.py` pins an immutable revision, uses exact HTTP ranges, reads no image columns and writes only Latvia/Lithuania/Belarus rows to an ignored staging file. Limits: 128 MB per read, 1.5 GB actual transferred bytes, 100,000 regional rows and a 30-minute job deadline checked between requests, each with a 60-second timeout. A source refusal, ignored range or incomplete extraction fails closed. No complete Parquet file is saved.

```sh
uv run --no-project --python 3.13 --with pyarrow==21.0.0 python scripts/extract-off-regional.py --apply
npx tsx scripts/import-off-regional-parquet.ts
# Inspect candidate/rejection counts first, then append only reviewed new GTINs:
npx tsx scripts/import-off-regional-parquet.ts --apply
npm run catalog:audit:personal-fit -- --write
npx tsx scripts/report-personal-fit-expansion.ts --write
```

The importer checks GTIN checksum, market tags, original language, package dimension, source quality flags, normalized per-100 values and duplicate conflicts. Existing OFF records and earlier observations are not overwritten. Unknown ingredients/fiber stay unknown; contradictory totals cannot become usable nutrition. OFF attribution stays separate from retailer data. This prepares local snapshots, not a database load; later seeding must use the documented Supabase tooling. A successful extraction/import report is required before claiming net-new products.

This document separates product coverage from visual recognition. A catalog row can help only after the camera or barcode resolves the exact brand, variant and pack size. It is not evidence that every package on a shelf will be recognized.

## Current source ladder

| Priority | Source | Runtime role | Current checked-in scope | Redistribution rule |
| --- | --- | --- | --- | --- |
| 1 | Sugar.no curated catalog | deterministic demo and reviewed products | 40 records | Sugar.no-owned |
| 2 | Barbora Latvia | exact identity, nutrition and offer | broad checked-in food snapshot | private demo snapshot; obtain permission for production reuse |
| 3 | Rimi Latvia | exact identity, nutrition and offer | 6,822 complete products from all 7,617 pages in seven approved categories | non-redistributable retailer snapshot; obtain permission before recurring production use |
| 4 | Livin Latvia | exact identity, nutrition and offer | 6 complete food pages from the full 169-URL public sitemap | non-redistributable retailer snapshot; obtain permission before recurring production use |
| 5 | Livinn Lithuania | multilingual exact identity, GTIN and nutrition | 2,489 edible identities, including 1,855 nutrition-complete products, from complete 5,926-URL canonical sitemap accounting | non-redistributable retailer snapshot; obtain permission before recurring production use |
| 6 | Open Food Facts | exact GTIN/multilingual-name nutrition fallback | 1,096 records: original 500 plus 596 new Latvia/Lithuania/Belarus-tagged records; original 119 alternate-name records retained; no guessed CSV aliases | ODbL database; attribution required; images have separate CC BY-SA terms |
| 7 | Cited web result | last-resort exact per-100 nutrition | runtime only | keep source URL and reject ambiguous variants |

The Rimi/Livin/Livinn counts are source-backed snapshot counts, not visual-recognition or market-coverage claims. Rimi covers meat/fish/prepared food, dairy/eggs, bakery, frozen food, packaged food, sweets/snacks and drinks. The Livinn identity index includes every page classified by the source under `Maistas`; only the nutrition-complete subset can receive a fit. The Open Food Facts release file is a bounded Latvia subset; the same isolated schema also accepts the official daily bulk export.

## Data separation

- `retailer_catalog_products` contains non-redistributable, nutrition-complete Rimi/Livin/Livinn page snapshots.
- `retailer_catalog_food_identities` contains exact Livinn edible identities and source-provided language aliases without pretending that missing nutrition is zero.
- `open_food_facts_products` contains the attributed ODbL-derived subset only. Its `aliases` array stores source-provided multilingual names for the same GTIN.
- `catalog_sources` stores terms, attribution and redistribution metadata.
- Personal Shelf Rank adds `retailer_shelf_evidence` and `open_food_facts_shelf_evidence` as separate RLS/server-role-only tables. Ingredients and extra nutrients retain one exact source, date and language; they are not merged across markets or recipes. The original 198-row pilot is expanded by the resumable supported-category batch, with separate OFF exact-barcode output. No OFF ingredients are synthesized from the old ingredient-free snapshot. Missing fiber can produce a bounded provisional assessment; missing essential or contradictory data cannot. Current counts and source limitations are in the [rollout log](test-runs/2026-09-03-personal-shelf-batch-rollout.md); see [ingestion rules](personal-shelf-rank.md).
- Never publish a mixed retailer/OFF derived dump. Do not copy retailer rows into the ODbL table.
- Product images remain source URLs. Bulk image reuse needs a separate rights review.

The schema is reproducible through `supabase/migrations/202609020001_livinn_multilingual_catalog.sql`. Apply and seed it with:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npm run supabase:seed:external
```

The deployed scanner can run from checked-in snapshots when Supabase is not configured. This is intentional for the private investor proof of concept, but a scheduled managed catalog is the production target.

## Rimi, Livin and Livinn refresh

The sync reads public product sitemaps and then fetches product pages at a bounded global rate. It accepts a rated row only when exact identity, energy, protein and total sugar are present. It never estimates missing nutrition. Full runs checkpoint under ignored `.catalog-sync/`, resume automatically and write a generated coverage report only after every sitemap URL has been accounted for.

```bash
RETAILER_SYNC_LIMIT=500 RETAILER_SYNC_MAX_FETCHES=1000 npm run catalog:sync:rimi
RETAILER_SYNC_LIMIT=100 RETAILER_SYNC_MAX_FETCHES=800 npm run catalog:sync:livin
RETAILER_SYNC_LIMIT=100 RETAILER_SYNC_MAX_FETCHES=800 npm run catalog:sync:livinn

# Full resumable import of the configured seven-category Rimi scope and all Livin Latvia URLs.
# Zero is the explicit unlimited value inside that configured scope.
RETAILER_SYNC_LIMIT=0 RETAILER_SYNC_MAX_FETCHES=0 npm run catalog:sync:rimi
RETAILER_SYNC_LIMIT=0 RETAILER_SYNC_MAX_FETCHES=0 npm run catalog:sync:livin
RETAILER_SYNC_LIMIT=0 RETAILER_SYNC_MAX_FETCHES=0 npm run catalog:sync:livinn
```

Review the generated snapshot and `data/*-catalog-sync-report.generated.json` for wrong brand, pack size, basis, availability, duplicate SKU, complete configured-scope accounting and source timestamp before seeding or committing. Set `RETAILER_SYNC_RIMI_CATEGORIES=all` only for an explicitly approved whole-store run. A production refresh must run only after permission from the retailer or an approved data provider.

## Open Food Facts bulk import

The checked-in 500-row Latvia snapshot can be refreshed at fewer than 10 requests per minute through the official structured search API:

```bash
OFF_LATVIA_LIMIT=500 npm run catalog:sync:off-latvia
```

This bounded bootstrap is for reproducible demo startup and exact local matching. The script refuses a limit above 500. It retains available `product_name_*` languages as aliases, but it does not replace the bulk path for a production-scale refresh.

For more than a few hundred products, Open Food Facts asks reusers to use its daily CSV/JSONL exports rather than repeated API searches. The compressed JSONL export was 12.8 GB on 31 August 2026, so run this as a scheduled data job with a stable long-lived connection and durable scratch storage, never inside the scanner web request or Railway build:

```bash
OFF_BULK_INPUT=/data/openfoodfacts-products.jsonl.gz npm run catalog:import:off
# Lithuania + Belarus write the separate regional snapshot used beside Latvia:
OFF_BULK_INPUT=/data/openfoodfacts-products.jsonl.gz OFF_BULK_MARKETS=lithuania,belarus npm run catalog:import:off
# or, in an approved data job:
OFF_BULK_INPUT=https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz npm run catalog:import:off
```

The importer streams the compressed file, keeps products tagged for the configured `latvia`, `lithuania` or `belarus` markets with a valid GTIN and complete per-100 energy/protein/total-sugar values, retains every available `product_name_*` alias, de-duplicates by GTIN and writes only the isolated OFF snapshot. It does not load the entire dump into memory. Multi-market runs default to `data/open-food-facts-regional.generated.json`; Latvia remains separately attributable. Review the resulting count and aliases, run `npm run verify`, apply the multilingual migration, and seed through `npm run supabase:seed:external` before release.

Official references:

- [Open Food Facts API and bulk guidance](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Official JSONL dump reference](https://openfoodfacts.github.io/robotoff/explanations/interactions-product-opener/)
- [Reuse and licensing](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/)
- [Rimi Latvia sitemap](https://www.rimi.lv/e-veikals/sitemap.xml)
- [Livin Latvia product sitemap](https://www.livin.lv/sitemap/products.xml)
- [Livinn Lithuania product sitemap](https://www.livinn.lt/sitemap/products.xml)

## Provider evaluation status

| Provider | Purpose | Status |
| --- | --- | --- |
| FatSecret Premier | localized branded-food and EAN coverage | requires provider-issued Premier evaluation credentials; no key is configured |
| NIQ Brandbank | licensed FMCG identity, images and nutrition | requires a provider-approved evaluation feed/API; no credentials are configured |
| GS1 Latvia | trusted GTIN identity attributes and access options | public Verified by GS1 is identity-only and limited; test API/feed access requires provider approval |

The exact requests and official routes are in `docs/partner-data-requests.md`. These commercial sources cannot be represented as connected until the provider issues credentials and rights for the scanner use case.
