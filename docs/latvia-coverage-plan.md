# Latvia product coverage plan

Checked: 2026-08-25

## Two different coverage metrics

`Identity coverage` means the scanner can name the exact SKU. `Sugar.no result coverage` means both protein and total sugar are source-backed; exact Barbora items also need energy to place protein in the reference band. These metrics must not be combined: a readable brand name is not evidence for nutrition.

Current proof-of-concept state:

- Gemini can name readable packages outside the curated catalog.
- the broad sitemap remains a discovery list, while a separate active non-adult food index is generated from Barbora's main grocery sections.
- a reproducible snapshot stores exact title, brand, category, pack size, image and source-backed energy, protein and total sugar for every eligible active food page; `/api/health` reports both the food-index denominator and automatic-fit count for the deployed commit.
- the checked-in 2026-08-25 snapshot contains 9,707 active non-adult food SKUs and 7,433 complete automatic-fit records: 76.57% source-data coverage across 817 brands and 276 retailer categories.
- 40 protein-snack records remain as the deterministic category-percentile benchmark, not the Latvia coverage ceiling.
- exact products in the broad snapshot receive a runtime two-factor reference fit; fiber is not a rating input.
- records without enough nutrition and non-food pages remain unrated; a food package can recover through one explicit scan of its printed per-100 nutrition table.

The pre-expansion public smoke found 20 distinct package identities across five Latvia scenes but only 5 automatic ratings. On the two close mayonnaise shelves, 4 of 12 identities were rated. The other three scenes include alcohol, cleaning products and distant checkout views, so the 25% aggregate is a release smoke baseline rather than a grocery accuracy estimate.

## External data check

Open Food Facts supports product lookup by barcode and normalized per-100-g nutrient fields through its current API. Its data is community-contributed and therefore cannot be assumed complete or correct. It is licensed under ODbL, images use CC BY-SA, and reuse needs attribution and database-separation review before production integration. Search endpoints are limited to 10 requests per minute per IP, so runtime search-as-you-type is not an acceptable architecture.

Live query used for this audit:

`GET https://world.openfoodfacts.org/api/v2/search?countries_tags_en=latvia&page_size=100&fields=code,product_name,brands,categories_tags,nutriments`

The API reported 4,767 products tagged for Latvia. In the first returned page of 100 records, 91 had a product name, 80 had numeric protein and total sugar, and 26 had all three Sugar.no inputs including fiber. This page is not a random sample and must not be extrapolated into a national coverage percentage.

Official references:

- [Open Food Facts API overview and limits](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Barcode product lookup](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/)
- [Product and nutrition schema](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product/)
- [Reuse and licensing](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/)
- [Browser BarcodeDetector limitations](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)
- [ZXing browser scanner and supported formats](https://github.com/zxing-js/browser)

## Recommended coverage pipeline

1. **Run barcode and visual recognition together.** EAN-13/EAN-8 gives the strongest exact-SKU key when a barcode is visible. Native `BarcodeDetector` cannot be the only web implementation because browser support is limited; use a tested EAN-capable WebAssembly/JavaScript fallback on iPhone Safari.
2. **Resolve the SKU through a source ladder.** Query a reviewed Sugar.no/Supabase record first, then the local broad Barbora nutrition snapshot, and only then an exact or strict separately attributed Open Food Facts record. The Barbora matcher uses brand, rare variant tokens, multilingual equivalents and exact pack or multipack size; a clear winner earns one live page read for current price. If two or three candidates remain tied, a second image pass receives only their IDs, titles and packshots and must clear 0.92 confidence; a slug outside that set is rejected server-side. If no source resolves, retain the visual identity as `Needs nutrition label`. Never let Gemini fill missing nutrition.
3. **Read sourced nutrition on demand.** Exact Barbora and Open Food Facts records can produce the two-factor reference view from energy, protein and total sugars. As the final recovery, the user may scan one printed per-100 nutrition table; that read is accepted only with matching OCR evidence. Fiber may remain in a raw record when a source supplies it, but it does not affect the fit.
4. **Add a label fallback.** If the SKU is known but a required nutrient is missing, ask the user to show the nutrition table. AI may transcribe the label into a review screen, but the rating becomes verified only after source validation. Raw images remain unsaved.
5. **Compare inside a category.** A yogurt, cola and protein bar must not share one percentile population. Store a reviewed category and calculate protein and inverse total sugar against that category's current sourced distribution.
6. **Build shelf recognition from exact SKU assets.** Store approved front-pack images or embeddings linked to GTINs. Visual matching proposes candidates; barcode, label text and brand/pack-size checks decide the exact SKU.
7. **Cache by GTIN in Supabase with provenance.** Keep every nutrient field's source, checked date and status. Open Food Facts-derived data should remain attributable and logically separated until ODbL obligations are reviewed.

## Realistic proof target

Do not promise “almost every Latvian product” yet. The broad snapshot materially increases automatic-fit candidates, but Rimi/Lidl/Stockmann private labels, products absent from Barbora, unreadable variants and pages without complete nutrition can still require barcode or label recovery. For the next validation, choose 200 products from real Rimi, Maxima and Barbora shelves across 8–10 categories and measure:

- exact identity top-1 accuracy;
- percentage with a complete protein-and-sugar rating;
- unsupported false-positive rate;
- median and p95 time to first useful result;
- number of products requiring barcode or back-label fallback.

The first scalable milestone should be at least 90% exact identity on that fixed benchmark and separately reported rated, one-factor and unrated percentages. Only then can the investor demo make a quantified Latvia coverage claim. The existence of 19,076 indexed pages must never be presented as 19,076 rated foods.
