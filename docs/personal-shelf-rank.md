# Personal Shelf Rank v1 — pilot contract

Status: isolated owner preview, 3 September 2026; not in production and not clinically validated. Model ID: `personal-shelf-v1.0-pilot`. [Try the preview](https://sugar-no-personal-rank-personal-rank-preview.up.railway.app). [Release verification](test-runs/2026-09-03-personal-shelf-preview-release.md).

## What the user gets

Expand a scan, turn on `Personal Shelf Rank`, compare products within one supported category, and open `Why this score?` for the original ingredients, nutrition, weighted points and dated source. The original Fit remains the default and is preserved exactly when the pilot is disabled. Camera markers, compact previews, prices and Better alternatives still use original Fit; the switch says so. Scores use neutral styling, not health traffic lights. The toggle is not saved across a reload.

There are two distinct numbers: a product preference score out of 100 and a relative place **among scorable products of the same type in this scan**. A single scored product gets no place. Exact score ties share competition ranks (1, 1, 3). Unsupported/missing products are visible but excluded from rank denominators, with coverage shown. Score is not a shelf percentile and price cannot affect it.

## Required evidence and language rules

Each observation contains exact canonical product ID, optional matching GTIN, source URL/date, source category, original ingredients/language and explicit per-100 g nutrients. No mixing of two similar products or country-specific recipes is allowed. Product-name aliases resolve identity but never become nutrient or ingredient evidence. Original composition is preserved; rules normalize accents/case and use audited English, Latvian, Lithuanian, Russian and Estonian terms. Unknown wording/language remains unknown. This dictionary is bounded, not a universal translation or NOVA classifier.

Energy, protein, total sugar, salt and saturated fat are required everywhere. Fiber is required for chips/crackers/bars/cookies and excluded from dairy scoring (not imputed as zero). Missing/negative/non-finite/out-of-range amounts, impossible protein-energy combinations, unknown food base, unsupported category or source mismatch produce no score. A declared zero remains zero; `<0.1 g` is not an exact zero and stays unknown. Liquids/per-100 ml and per-serving tables are outside v1. Allergens, intolerances, pregnancy suitability, glycemic response and individual medical risks are not assessed.

Exact total carbohydrate and total fat are additional consistency fields, not extra score components. The sum of known protein/carbohydrate/fat cannot exceed 101 g per 100 g (1 g label-rounding allowance); sugar cannot exceed carbs by more than 1 g or saturates exceed fat by more than 1 g. Sugar/saturates are never double-counted in mass totals. Contradictory raw records stay visible for audit but cannot drive either pilot score or original Fit; this is a source-validity exception to preserving old ratings, not a new old-Fit formula. Missing extra fields do not become zero and cannot prove complete consistency.

Categories use the most specific source category, not marketing names. Known conflicting evidence (e.g. curd cream filed under yogurt) prevents scoring; unseen retailer taxonomy mistakes still require manual review. Fixed source categories need more granular calibration before broad rollout.

## Formula: evidence anchors versus product choices

The following **weights, linear curves, food-base points and 59-point ceiling are Sugar.no pilot design choices**, not WHO/EFSA recommendations or an official validated nutrition score. They must be versioned whenever changed. No universal “good food” cutoffs are shown.

| Product type | Sugar | Protein | Food base | Balance |
| --- | ---: | ---: | ---: | ---: |
| Chips; crackers/crispbreads (separate rank groups) | 10 | 10 | 30 | 50 |
| Spoonable yogurt; dairy dessert (separate groups) | 30 | 25 | 20 | 25 |
| Snack bar; cookie/wafer (separate groups) | 30 | 20 | 25 | 25 |

Every component is normalized to 0–100, then multiplied by its weight/100. Component contributions are rounded to one decimal; the sum is rounded to an integer.

- Sugar: 100 points at ≤5 g/100 g, linear to 0 at ≥22.5 g/100 g. These are **total** sugars; dairy lactose and added sugars are not numerically separated. Ingredient evidence provides a separate explicit sugar/honey/syrup signal.
- Protein: percentage of energy from protein = `protein g × 4 / kcal × 100`; linear from 0 to 100 points at 20% energy, capped there. Grams and energy percentage are disclosed; high grams per 100 g alone do not guarantee the highest score.
- Food base: recognized whole-grain/legume/nut base 100; milk/yogurt base 85; potato/corn base 75; refined flour/rice/starch/isolated protein base 25; sugar/honey/syrup first 0. Unknown or oil-first bases are unscored, not bad by default. Specific extracted-component rules take precedence over “potato”, “milk” or “nut” fragments. Sugar/honey/syrup in the first three top-level ingredient groups, including compound ingredients, limits this component to 40. This is ingredient-order evidence, **not** an estimate of added sugar grams.
- Balance subweights: chips/crackers salt 50%, saturates 30%, fiber 20%; yogurt/dairy salt 35%, saturates 65%, no fiber; bars/cookies salt 20%, saturates 40%, fiber 40%. Salt scores 100 at ≤0.3 g, linear to 0 at ≥1.5 g; saturates 100 at ≤1.5 g, linear to 0 at ≥5 g; fiber is linear 0–6 g to 0–100 points. All are per 100 g.
- If sugar **>22.5 g**, salt **>1.5 g** or saturates **>5 g** per 100 g, overall score cannot exceed **59/100**. The UI names the limiting nutrient. This ceiling prevents protein from fully compensating for a limiting nutrient; 59 is a provisional product-policy value, not a medical boundary.

The low/high sugar, salt and saturate anchors come from the [NHS food-label guide](https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/how-to-read-food-labels/). The [EU nutrition-claims regulation, Annex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006R1924) uses 12%/20% energy for source-of/high-protein claims and 3/6 g fiber per 100 g (or energy-based alternatives) for fiber claims. Those references do **not** validate this ranking formula. The UI's low-protein/fiber notices describe numeric anchors, not a claim of legal certification.

There is no additive-count or ingredient-count penalty. Sweeteners are disclosed without a blanket safety penalty. Organic, gluten-free, high-protein or no-added-sugar marketing does not supply missing evidence. The model does not calculate NOVA, a toxin score, calorie allowance or an individual health prediction. A chip can be a higher-ranked chip without becoming an unlimited everyday recommendation; portion size and the overall diet still matter.

## Data snapshot and reproducibility

The 198-row snapshot was obtained through two bounded public-page batches, 100 selected pages each (99 successfully extracted in each); the second batch excluded existing IDs. Three first-batch records were re-read after recognizing Livinn's abbreviated saturates label. Failed fetches left earlier observations untouched. No broad OFF dump or store-wide composition crawl ran.

Real-card visual QA then found a source error in [Livinn GO PURE CANYON chips](https://www.livinn.lt/p/go-pure-ekologiski-bulviu-traskuciai-su-krapais-ir-laiskiniais-cesnakais-125-g-03000011074): its exact labelled table reports protein 57.8 g, carbs 47 g and fat 29 g per 100 g. A direct page re-read confirmed those fields. No alternative value was inferred. The 198 observations were re-fetched with extra macro fields; the contradiction now leaves that SKU unscored in both models, and the visual regression explicitly checks this case.

| Group | Exact observations | Complete score |
| --- | ---: | ---: |
| Chips | 40 | 15 |
| Crackers/crispbreads | 40 | 9 |
| Spoonable yogurt | 38 | 31 |
| Bars | 40 | 4 |
| Cookies/wafers | 40 | 5 |
| Dairy desserts | 0 | 0 |
| Total | 198 | 64 |

Coverage is not a recognition benchmark. Missing fiber is common on retailer labels. Do not relax null handling or borrow another product's nutrients to improve coverage. Curated/demo/grounded-web identities without a separate full observation stay unscored in this pilot, even when they have original Fit. Exact live OFF and Barbora page adapters now retain additional composition evidence; old OFF snapshots will not magically acquire it.

```bash
# Inspect the request plan; no network calls or writes.
npm run catalog:sync:shelf-pilot
# Explicit small pilot refresh; sources/IDs already come from local catalogs.
npm run catalog:sync:shelf-pilot -- --apply
# Select the next bounded batch instead of re-reading current IDs.
npm run catalog:sync:shelf-pilot -- --apply --new-only
# Re-read exactly the already selected pilot IDs without expanding scope.
npm run catalog:sync:shelf-pilot -- --apply --refresh-existing
# Optional env: SHELF_PILOT_PER_CATEGORY=20 (1..100), SHELF_PILOT_IDS=id1,id2

# Validate counts without touching Supabase.
npm run supabase:seed:shelf-pilot
npm run catalog:validate:shelf-pilot
# Only after approval of target, migration and retailer reuse:
npx supabase db push
npm run supabase:seed:shelf-pilot -- --apply
```

The new additive migration is `202609030001_personal_shelf_evidence.sql`. Retailer and ODbL evidence stay in separate RLS tables, accessible only to the server role; no scan image/history or personal diet data is stored. Seed uses upserts, no deletes, and checks each stored evidence field on readback. `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` are the existing environment variables. Production migration/seed were not run in this implementation turn.

At runtime `/api/personal-shelf` accepts at most ten exact IDs, rejects cross-origin/oversized/invalid requests and rate limits. It makes a bounded two-second Supabase read only after opt-in; missing tables/offline storage preserve the local snapshot. It never invokes web search or modifies storage. Identity and observation schema/source host are rechecked before a managed record replaces an older local one. The browser discards responses after cancellation or scan replacement.

## Technical checks

`npm run verify` covers lint, types, all unit/integration tests, source validators and standalone build. `CI=1 npm run test:e2e` covers original scanner regressions plus opt-in, category ties, missing data, source disclosure, no legacy change, 375 px/dark/reduced-motion/200% text/landscape and axe checks. Dry-run the sync/seed. Evidence is recorded in the dated test log; screenshots remain ignored under `test-results/`.

## Owner product check

1. Scan two or more comparable products, expand `View all`, then enable the pilot. Is the top choice reasonable **for that category**? Open the explanation and compare the exact source numbers with the package. Do not assume all shelf products have sufficient data.
2. Include a high-protein sugary/salty product and an incomplete label. Check the former's explicit limiting-nutrient ceiling and the latter's absence of a numeric score. Test a translated package name against the same exact SKU/variant; a different flavor must not inherit ingredients.
3. Turn the pilot off, collapse and retry. Original Fit/order, camera behavior and exact offers should be unchanged. Verify real-phone readability and convenience, not just automated layout checks.

Before replacing default Fit, review a balanced real-package set (including lower-scoring and incomplete items) in every supported category, independently check source identity/ingredients/nutrients, and record agreement plus surprising rankings. Dairy-dessert calibration and physical-store acceptance are still open. Do not describe this pilot as a researched guarantee that a product is healthier or safer.
