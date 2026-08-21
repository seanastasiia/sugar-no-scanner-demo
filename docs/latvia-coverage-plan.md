# Latvia product coverage plan

Checked: 2026-08-21

## Two different coverage metrics

`Identity coverage` means the scanner can name the exact SKU. `Sugar.no rating coverage` means the same SKU also has sourced protein, fiber and total sugar plus a valid comparison category. These metrics must not be combined: a readable brand name is not evidence for nutrition.

Current proof-of-concept state:

- Gemini can name readable packages outside the curated catalog.
- 19,076 Barbora Latvia product-page slugs are indexed for retailer discovery.
- 40 protein-snack records contain sourced protein and total sugar.
- 10 of those 40 currently have independently sourced fiber and receive a complete Sugar.no rating.

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
2. **Resolve the SKU through a source ladder.** Query a reviewed Sugar.no/Supabase record first, then a separately attributed Open Food Facts record by GTIN, then an exact Barbora product page, and finally visual identity only. Never let Gemini generate nutrition.
3. **Read retailer nutrition on demand.** Exact Barbora pages commonly expose protein and total sugar. Use numeric fiber only when the retailer, manufacturer, Open Food Facts or a readable package label actually supplies it.
4. **Add a label fallback.** If the SKU is known but a required nutrient is missing, ask the user to show the nutrition table. AI may transcribe the label into a review screen, but the rating becomes verified only after source validation. Raw images remain unsaved.
5. **Compare inside a category.** A yogurt, cola and protein bar must not share one percentile population. Store a reviewed category and calculate the three signals against that category's current sourced distribution.
6. **Build shelf recognition from exact SKU assets.** Store approved front-pack images or embeddings linked to GTINs. Visual matching proposes candidates; barcode, label text and brand/pack-size checks decide the exact SKU.
7. **Cache by GTIN in Supabase with provenance.** Keep every nutrient field's source, checked date and status. Open Food Facts-derived data should remain attributable and logically separated until ODbL obligations are reviewed.

## Realistic proof target

Do not promise “almost every Latvian product” yet. For the next validation, choose 200 products from real Rimi, Maxima and Barbora shelves across 8–10 categories and measure:

- exact identity top-1 accuracy;
- percentage with a complete three-signal rating;
- unsupported false-positive rate;
- median and p95 time to first useful result;
- number of products requiring barcode or back-label fallback.

The first scalable milestone should be at least 90% exact identity on that fixed benchmark and a separately reported rating-coverage percentage. Only then can the investor demo make a quantified Latvia coverage claim.
