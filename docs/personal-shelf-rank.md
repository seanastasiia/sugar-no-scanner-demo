# Personal Shelf Rank v1.1 — bounded rollout contract

Status: owner-authorized opt-in production rollout, 3 September 2026; not clinically validated and not a replacement for default Fit. Model ID: `personal-shelf-v1.1-bounded`. [Production](https://sugar-no-scanner-demo-production.up.railway.app). [Release verification](test-runs/2026-09-03-personal-shelf-batch-rollout.md).

For an immediate camera-free example, open [New rating demo](https://sugar-no-scanner-demo-production.up.railway.app/demo/personal-shelf). Its four selected chip records use the same scorer: 64/61, real PROPER lentil chips 57–59 with unknown fiber and one unscored contradictory-source chip. The Yogurts demo tab is removed; real yogurt recognition and assessment are unchanged. This is a labelled selection, not a recognition test or market-wide ranking. No refresh or provider request is made by the demo.

## What the user gets

Expand a scan, turn on `Personal Shelf Rank`, compare products within one supported category, and open `Why this score?` for the weighted component points. Demo and scan cards no longer render the full nutrient/ingredient block, dated source link or model footer. The exact evidence remains stored and continues to drive the same formula; concise provisional, ceiling and missing-data explanations remain visible. The original Fit remains the default and is preserved exactly when the pilot is disabled. Camera markers, compact previews, prices and Better alternatives still use original Fit; the switch says so. Scores use neutral styling, not health traffic lights. The toggle is not saved across a reload.

There are two distinct numbers: a product preference score/range out of 100 and a relative place **among assessable products of the same type in this scan**. A single assessed product gets no place. Fully known exact ties share competition ranks (1, 1, 3). Provisional ranges sort by their lower bound; every provisional assessment and any full score overlapping a provisional range has a visibly provisional place, not a verified winner/tie. Essential-missing/unsupported products remain visible but excluded from rank denominators. Score is not a percentile and price cannot affect it.

## Required evidence and language rules

Each observation contains exact canonical product ID, optional matching GTIN, source URL/date, source category, original ingredients/language and explicit per-100 g nutrients. No mixing of two similar products or country-specific recipes is allowed. Product-name aliases resolve identity but never become nutrient or ingredient evidence. Original composition is preserved; rules normalize accents/case and use audited English, Latvian, Lithuanian, Russian and Estonian terms. Unknown wording/language remains unknown. This dictionary is bounded, not a universal translation or NOVA classifier.

Energy, protein, total sugar, salt and saturated fat are required everywhere. Fiber is used for chips/crackers/bars/cookies; explicitly null fiber produces a provisional range using its 0–10 possible point contribution, with fixed other weights and the same ceilings at both ends. Stored fiber remains null and `score` remains null; consumers use `scoreRange`. Dairy excludes fiber entirely. Invalid/negative/non-finite/out-of-range amounts, impossible protein-energy combinations, unknown food base, unsupported category or source mismatch produce no score. A declared zero remains zero; `<0.1 g` stays unknown. Liquids/per-100 ml and per-serving tables are outside v1. Allergens, intolerances, pregnancy suitability, glycemic response and individual medical risks are not assessed.

Exact total carbohydrate and total fat are additional consistency fields, not extra score components. The sum of known protein/carbohydrate/fat cannot exceed 101 g per 100 g (1 g label-rounding allowance); sugar cannot exceed carbs by more than 1 g or saturates exceed fat by more than 1 g. Sugar/saturates are never double-counted in mass totals. Contradictory raw records stay visible for audit but cannot drive either pilot score or original Fit; this is a source-validity exception to preserving old ratings, not a new old-Fit formula. Missing extra fields do not become zero and cannot prove complete consistency.

Categories use the most specific source category, not marketing names. Rimi source URL taxonomy excludes the product-name slug, so a dip marketed “for chips” cannot become chips. Known conflicting evidence (e.g. curd cream filed under yogurt) prevents scoring; unseen retailer taxonomy mistakes still require manual review. Unsupported categories are not assigned a nearest-category model.

## Formula: evidence anchors versus product choices

The following **weights, linear curves, food-base points and 59-point ceiling are Sugar.no pilot design choices**, not WHO/EFSA recommendations or an official validated nutrition score. They must be versioned whenever changed. No universal “good food” cutoffs are shown.

| Product type | Sugar | Protein | Food base | Balance |
| --- | ---: | ---: | ---: | ---: |
| Chips; crackers/crispbreads (separate rank groups) | 10 | 10 | 30 | 50 |
| Spoonable yogurt; dairy dessert (separate groups) | 30 | 25 | 20 | 25 |
| Snack bar; cookie/wafer (separate groups) | 30 | 20 | 25 | 25 |

Every component is normalized to 0–100, then multiplied by its weight/100. Component contributions are rounded to one decimal; integer tenths are summed before final rounding to avoid binary half-point errors. The audited 64 complete baseline scores are unchanged in v1.1. Missing-fiber bounds remain at most ten points apart; a ceiling can collapse them to one displayed value, still explicitly provisional.

- Sugar: 100 points at ≤5 g/100 g, linear to 0 at ≥22.5 g/100 g. These are **total** sugars; dairy lactose and added sugars are not numerically separated. Ingredient evidence provides a separate explicit sugar/honey/syrup signal.
- Protein: percentage of energy from protein = `protein g × 4 / kcal × 100`; linear from 0 to 100 points at 20% energy, capped there. Grams and energy percentage are disclosed; high grams per 100 g alone do not guarantee the highest score.
- Food base: recognized whole-grain/legume/nut base 100; milk/yogurt base 85; potato/corn base 75; refined flour/rice/starch/isolated protein base 25; sugar/honey/syrup first 0. Unknown or oil-first bases are unscored, not bad by default. Specific extracted-component rules take precedence over “potato”, “milk” or “nut” fragments. Sugar/honey/syrup in the first three top-level ingredient groups, including compound ingredients, limits this component to 40. This is ingredient-order evidence, **not** an estimate of added sugar grams.
- Balance subweights: chips/crackers salt 50%, saturates 30%, fiber 20%; yogurt/dairy salt 35%, saturates 65%, no fiber; bars/cookies salt 20%, saturates 40%, fiber 40%. Salt scores 100 at ≤0.3 g, linear to 0 at ≥1.5 g; saturates 100 at ≤1.5 g, linear to 0 at ≥5 g; fiber is linear 0–6 g to 0–100 points. All are per 100 g.
- If sugar **>22.5 g**, salt **>1.5 g** or saturates **>5 g** per 100 g, overall score cannot exceed **59/100**. The UI names the limiting nutrient. This ceiling prevents protein from fully compensating for a limiting nutrient; 59 is a provisional product-policy value, not a medical boundary.

The low/high sugar, salt and saturate anchors come from the [NHS food-label guide](https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/how-to-read-food-labels/). The [EU nutrition-claims regulation, Annex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006R1924) uses 12%/20% energy for source-of/high-protein claims and 3/6 g fiber per 100 g (or energy-based alternatives) for fiber claims. Those references do **not** validate this ranking formula. The UI's low-protein/fiber notices describe numeric anchors, not a claim of legal certification.

There is no additive-count or ingredient-count penalty. Sweeteners are disclosed without a blanket safety penalty. Organic, gluten-free, high-protein or no-added-sugar marketing does not supply missing evidence. The model does not calculate NOVA, a toxin score, calorie allowance or an individual health prediction. A chip can be a higher-ranked chip without becoming an unlimited everyday recommendation; portion size and the overall diet still matter.

## Baseline and batch reproducibility

The original 198-row snapshot was obtained through two bounded public-page batches. It is a historical baseline, not current coverage. The accelerated rollout reads known URLs only in the six supported categories, one worker per source, with no search/model calls. Rimi, Barbora and Livinn retailer observations stay separate from the OFF ODbL file/table. Any HTTP 429 stops that source queue; checkpoints allow explicit later resumption. A failed source or changed SKU cannot overwrite older evidence. Current attempts, partial coverage and validated counts are in the rollout log.

Real-card visual QA then found a source error in [Livinn GO PURE CANYON chips](https://www.livinn.lt/p/go-pure-ekologiski-bulviu-traskuciai-su-krapais-ir-laiskiniais-cesnakais-125-g-03000011074): its exact labelled table reports protein 57.8 g, carbs 47 g and fat 29 g per 100 g. A direct page re-read confirmed those fields. No alternative value was inferred. The 198 observations were re-fetched with extra macro fields; the contradiction now leaves that SKU unscored in both models, and the visual regression explicitly checks this case.

Historical baseline before the batch (v1.0):

| Group | Exact observations | Complete score |
| --- | ---: | ---: |
| Chips | 40 | 15 |
| Crackers/crispbreads | 40 | 9 |
| Spoonable yogurt | 38 | 31 |
| Bars | 40 | 4 |
| Cookies/wafers | 40 | 5 |
| Dairy desserts | 0 | 0 |
| Total | 198 | 64 |

Coverage is not a recognition benchmark or a globally deduplicated product count. v1.1 additionally assesses 82 baseline records provisionally; 52 still lack essential/consistent evidence. Never borrow another product's nutrients to improve coverage. Curated/demo/grounded-web identities without a separate compatible observation stay unscored in this pilot, even when they have original Fit. Existing OFF snapshots acquire composition only through exact-source refreshes.

```bash
# Fast resumable supported-category batch; dry-run is default.
npm run catalog:sync:shelf-batch
npm run catalog:sync:shelf-batch -- --apply
# Optional SHELF_BATCH_LIMIT_PER_SOURCE=20; failed URLs need explicit --retry-failed.
# Honor source cooldowns before resuming. No autonomous retry/scheduled job is created.

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

The additive migration is `202609030002_personal_shelf_evidence.sql` (001 is the pre-existing shared web catalog migration). Retailer and ODbL evidence stay in separate RLS tables, accessible only to the server role; no scan image/history or personal diet data is stored. The atomic RPC keeps an existing newer whole observation, performs no deletes and rejects source/prefix mismatches. Seed checks each stored evidence field on readback. `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY` are existing environment variables. See the rollout log for live application/seed verification.

At runtime `/api/personal-shelf` accepts at most ten exact IDs, rejects cross-origin/oversized/invalid requests and rate limits. It makes a bounded two-second Supabase read only after opt-in; missing tables/offline storage preserve the local snapshot. It never invokes web search or modifies storage. Identity and observation schema/source host are rechecked before a managed record replaces an older local one. The browser discards responses after cancellation or scan replacement.

## Technical checks

`npm run verify` covers lint, types, all unit/integration tests, source validators and standalone build. `CI=1 npm run test:e2e` covers original scanner regressions plus opt-in, category ties, missing data, source disclosure, no legacy change, 375 px/dark/reduced-motion/200% text/landscape and axe checks. Dry-run the sync/seed. Evidence is recorded in the dated test log; screenshots remain ignored under `test-results/`.

## Owner product check

1. Scan two or more comparable products, expand `View all`, then enable the pilot. Is the top choice reasonable **for that category**? Open the explanation and compare the exact source numbers with the package. Do not assume all shelf products have sufficient data.
2. Include a high-protein sugary/salty product, a missing-fiber label and a missing-salt label. Check the ceiling, the explicit provisional range and the absence of a score respectively. Test a translated package name against the same exact SKU/variant; a different flavor must not inherit ingredients.
3. Turn the pilot off, collapse and retry. Original Fit/order, camera behavior and exact offers should be unchanged. Verify real-phone readability and convenience, not just automated layout checks.

Before replacing default Fit, review a balanced real-package set (including lower-scoring and incomplete items) in every supported category, independently check source identity/ingredients/nutrients, and record agreement plus surprising rankings. Dairy-dessert calibration and physical-store acceptance are still open. Do not describe this pilot as a researched guarantee that a product is healthier or safer.
