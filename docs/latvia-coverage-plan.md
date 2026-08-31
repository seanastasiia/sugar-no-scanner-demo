# Latvia product coverage plan

Checked: 2026-08-31

## Two different coverage metrics

`Identity coverage` means the scanner can name the exact SKU. `Sugar.no result coverage` means both protein and total sugar are source-backed; exact Barbora items also need energy to place protein in the reference band. These metrics must not be combined: a readable brand name is not evidence for nutrition.

Current proof-of-concept state:

- Gemini can name readable packages outside the curated catalog.
- the broad sitemap remains a discovery list, while a separate active non-adult food index is generated from Barbora's main grocery sections.
- a reproducible snapshot stores exact title, brand, category, pack size, image and source-backed energy, protein and total sugar for every eligible active food page; `/api/health` reports both the food-index denominator and automatic-fit count for the deployed commit.
- the checked-in 2026-08-25 snapshot contains 9,707 active non-adult food SKUs and 7,433 complete automatic-fit records: 76.57% source-data coverage across 817 brands and 276 retailer categories.
- 40 protein-snack records remain as the deterministic category-percentile benchmark, not the Latvia coverage ceiling.
- exact products in the broad snapshot receive a runtime two-factor reference fit; fiber is not a rating input.
- strict Rimi and Livin adapters now provide 6,822 and 6 complete product-page rows respectively. Rimi's count comes from checking all 7,617 pages in seven approved food and drink categories. Livin's count comes after checking the full 169-URL Latvia sitemap, which also contains cosmetics and localized duplicates; neither count is visual-recognition or full-retailer coverage.
- Open Food Facts has 500 complete Latvia-tagged records in a separate ODbL layer plus a streaming daily-JSONL importer. The refreshed proof subset retains multilingual source names for 119 records, and the matcher uses them without weakening exact-SKU checks. A scheduled full bulk import is still required for production-scale coverage.
- records without enough exact nutrition and non-food pages remain unrated; the current demo does not invent values or ask the user for a second label scan.

The pre-expansion public smoke found 20 distinct package identities across five Latvia scenes but only 5 automatic ratings. On the two close mayonnaise shelves, 4 of 12 identities were rated. The other three scenes include alcohol, cleaning products and distant checkout views, so the 25% aggregate is a release smoke baseline rather than a grocery accuracy estimate.

## External data check

Open Food Facts supports product lookup by barcode and normalized per-100-g nutrient fields through its current API. Its data is community-contributed and therefore cannot be assumed complete or correct. It is licensed under ODbL, images use CC BY-SA, and reuse needs attribution and database-separation review before production integration. Search endpoints are limited to 10 requests per minute per IP, so runtime search-as-you-type is not an acceptable architecture.

Live query used for this audit:

`GET https://world.openfoodfacts.org/api/v2/search?countries_tags_en=latvia&page_size=100&fields=code,product_name,product_name_en,product_name_lv,product_name_ru,lang,languages_codes,brands,quantity,nutrition_data_per,nutriments`

The API reported 4,802 products tagged for Latvia on 31 August 2026. In the first popularity-sorted page of 100 records, 78 passed the scanner's strict completeness gate for GTIN, name, energy, protein and total sugar, and 24 had more than one distinct value across the Latvian, English and Russian name fields. This page is not a random sample and must not be extrapolated into a national coverage percentage. The exact complete Latvia count remains unknown until the full bulk job finishes.

Official references:

- [Open Food Facts API overview and limits](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Barcode product lookup](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/)
- [Product and nutrition schema](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product/)
- [Reuse and licensing](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/)
- [Browser BarcodeDetector limitations](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)
- [ZXing browser scanner and supported formats](https://github.com/zxing-js/browser)

## Recommended coverage pipeline

1. **Run barcode and visual recognition together.** EAN-13/EAN-8 gives the strongest exact-SKU key when a barcode is visible. Native `BarcodeDetector` cannot be the only web implementation because browser support is limited; use a tested EAN-capable WebAssembly/JavaScript fallback on iPhone Safari.
2. **Resolve the SKU through a source ladder.** Query a reviewed Sugar.no/Supabase record first, then the local broad Barbora nutrition snapshot, strict Rimi/Livin snapshots, the isolated Open Food Facts layer and finally a Google Search-grounded exact product page. Matchers require brand, variant tokens and exact pack size where available. The grounded fallback requires the same exact variant, an HTTPS citation, per-100 protein and total sugars and confidence at least 0.90. If no source resolves, keep the visual identity only as internal scan evidence and hide it from the final comparison. Never let Gemini estimate missing nutrition.
3. **Read sourced nutrition automatically.** Exact Barbora, Open Food Facts and cited exact web records can produce the two-factor reference view from energy, protein and total sugars. The user-facing nutrition-label scan is disabled. Fiber may remain in a raw record when a source supplies it, but it does not affect the fit.
4. **Add a label fallback.** If the SKU is known but a required nutrient is missing, ask the user to show the nutrition table. AI may transcribe the label into a review screen, but the rating becomes verified only after source validation. Raw images remain unsaved.
5. **Compare inside a category.** A yogurt, cola and protein bar must not share one percentile population. Store a reviewed category and calculate protein and inverse total sugar against that category's current sourced distribution.
6. **Build shelf recognition from exact SKU assets.** Store approved front-pack images or embeddings linked to GTINs. Visual matching proposes candidates; barcode, label text and brand/pack-size checks decide the exact SKU.
7. **Cache by GTIN in Supabase with provenance.** Keep every nutrient field's source, checked date and status. Open Food Facts-derived data should remain attributable and logically separated until ODbL obligations are reviewed.

## Realistic proof target

Do not promise “almost every Latvian product” yet. The broad snapshot and cited web fallback materially increase automatic-fit candidates, but Rimi/Lidl/Stockmann private labels, unreadable variants and products without an exact per-100 source can still remain unresolved. For the next validation, choose 200 products from real Rimi, Maxima and Barbora shelves across 8–10 categories and measure:

- exact identity top-1 accuracy;
- percentage with a complete protein-and-sugar rating;
- unsupported false-positive rate;
- median and p95 time to first useful result;
- number of products requiring barcode or back-label fallback.

The first scalable milestone should be at least 90% exact identity on that fixed benchmark and separately reported rated, one-factor and unrated percentages. Only then can the investor demo make a quantified Latvia coverage claim. The existence of 19,076 indexed pages must never be presented as 19,076 rated foods.
