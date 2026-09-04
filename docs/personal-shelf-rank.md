# Personal Shelf Rank v1.5 — bounded preview contract

Status: v1.5 adds reviewed source-category leaves to the nineteen-type isolated preview, 4 September 2026; weights and nutrient curves are unchanged. It is not clinically validated and does not replace default Fit. Model ID: `personal-shelf-v1.5-bounded`. Production keeps its separately approved release. [Preview](https://sugar-no-personal-rank-personal-rank-preview.up.railway.app/).

The bounded expansion maps only exact leaf labels for nuts/seeds, long pasta, specific breads, canned fish and boxed candy to existing types. All earlier assessed results and demos are compared per ID against `b4e7453` using `scripts/report-personal-fit-expansion.ts`. Source-language ingredients and null values are preserved; product-name guesses never create a category. See [the execution plan](personal-fit-expansion-plan.md).

For an immediate camera-free example, open [New rating demo](https://sugar-no-personal-rank-personal-rank-preview.up.railway.app/demo/personal-shelf). Its four selected chip records use the same scorer: 64/61, real PROPER lentil chips 57–59 with unknown fiber and one unscored contradictory-source chip. The Yogurts demo tab is removed; real yogurt recognition and assessment are unchanged. This is a labelled selection, not a recognition test or market-wide ranking. No refresh or provider request is made by the demo.

## What the user gets

Expand a scan, turn on `Personal Shelf Rank`, compare products within one supported category, and open `Why this score?` for the weighted component points. Demo and scan cards no longer render the full nutrient/ingredient block, dated source link or model footer. The exact evidence remains stored and continues to drive the same formula; concise provisional, ceiling and missing-data explanations remain visible. The original Fit remains the default and is preserved exactly when the pilot is disabled. Camera markers, compact previews, prices and Better alternatives still use original Fit; the switch says so. The toggle is not saved across a reload.

At the owner's request, presentation-band v1 adds `Great fit` (75–100), `Moderate fit` (50–74) and `Low fit` (0–49), with green/amber/coral badges and subtle card tints. These are personal-score preference bands, not health traffic lights or official thresholds. `src/lib/personal-shelf-fit.ts` consumes an existing assessment without recalculating it; the numeric model is v1.5. Both bounds of a provisional range must agree before it receives one colored badge. A cross-band range uses a neutral label such as `Moderate to Great fit`, never its optimistic endpoint alone. Provisional and ceiling disclosures remain. Unscored, unsupported and malformed assessments get no fit badge. The three-band legend is available in each scored card's disclosure.

There are two distinct numbers: a product preference score/range out of 100 and a relative place **among assessable products of the same type in this scan**. A single assessed product gets no place. Fully known exact ties share competition ranks (1, 1, 3). Provisional ranges sort by their lower bound; every provisional assessment and any full score overlapping a provisional range has a visibly provisional place, not a verified winner/tie. Essential-missing/unsupported products remain visible but excluded from rank denominators. Score is not a percentile and price cannot affect it.

The compact presentation omits group counters, introductory boilerplate and verbose missing-data text. Supported incomplete cards show a neutral dash with `Not scored` accessibility text. Unsupported and unresolved named packages remain as ordinary compact cards under `More products`, excluded from ranking. No supported categories is not an empty scan; only zero cards can show an empty-state message.

## Required evidence and language rules

Each observation contains exact canonical product ID, optional matching GTIN, source URL/date, source category, original ingredients/language and explicit per-100 g nutrients. No mixing of two similar products or country-specific recipes is allowed. Product-name aliases resolve identity but never become nutrient or ingredient evidence. Original composition is preserved; rules normalize accents/case and use audited English, Latvian, Lithuanian, Russian and Estonian terms. Unknown wording/language remains unknown. This dictionary is bounded, not a universal translation or NOVA classifier.

Energy, protein, total sugar, salt and saturated fat are required everywhere. Fiber is used only where the category profile assigns it a weight; explicitly null fiber produces a provisional range covering that fixed contribution, always no more than ten points, with the same ceilings at both ends. Stored fiber remains null and `score` remains null; consumers use `scoreRange`. Yogurt, dairy dessert, ice cream, cheese, meat and fish profiles exclude fiber. Invalid/negative/non-finite/out-of-range amounts, impossible protein-energy combinations, unknown food base, unsupported category or source mismatch produce no score. `<0.1 g` stays unknown. Per-serving and incompatible per-100 ml tables are outside v1. Allergens, intolerances, pregnancy suitability, glycemic response and individual medical risks are not assessed.

The original seven category profiles retain their prior zero handling. For newly added categories only, a literal source zero fails closed when the same exact page contradicts it: sugar is listed in the ingredients, salt is listed for cheese/meat/fish, or saturated fat is zero while total fat is at least 10 g/100 g. This catches known retailer placeholders without guessing a replacement value. It cannot prove that every other published zero is correct.

Exact total carbohydrate and total fat are additional consistency fields, not extra score components. The sum of known protein/carbohydrate/fat cannot exceed 101 g per 100 g (1 g label-rounding allowance); sugar cannot exceed carbs by more than 1 g or saturates exceed fat by more than 1 g. Sugar/saturates are never double-counted in mass totals. Contradictory raw records stay visible for audit but cannot drive either pilot score or original Fit; this is a source-validity exception to preserving old ratings, not a new old-Fit formula. Missing extra fields do not become zero and cannot prove complete consistency.

Categories use the most specific source category, not marketing names. Rimi source URL taxonomy excludes the product-name slug, so a dip marketed “for chips” cannot become chips. Known conflicting evidence (e.g. curd cream filed under yogurt) prevents scoring; unseen retailer taxonomy mistakes still require manual review. Unsupported categories are not assigned a nearest-category model.

## Formula: evidence anchors versus product choices

### v1.4 vocabulary-only coverage pass

The former v1.3 restriction on new-family vocabulary is relaxed only for reviewed previously unknown first ingredients. A separate, bounded fallback dictionary applies after the existing classifier returns unknown. It normalizes accents, processing descriptors, leading percentages and label formatting, and recognizes explicit whole-plant/cocoa-mass bases (100), dairy/cream/cheese bases (85), and refined grain/noodle/dough/confectionery compounds (25). Latvian milk powder follows the existing English milk-base rule (85 before any sugar-order cap), not an isolated-protein rule; plant powders are not assumed whole plants. The animal-base share limits also cover the added species labels, including parenthesized shares. These remain pilot composition choices, not a new health standard.

The fallback requires a supported language and explicit category. It never skips water/oil, uses a later ingredient to replace an unknown first one, reads nutrients from a product-name translation, or changes any source bytes. Extract/fraction/flavour guards distinguish plants from oils, juices, concentrates, powders and fillings. Unbalanced first-ingredient brackets fail closed. Two found category conflicts (wafer-cone ice cream filed as cookies and a curd dessert filed as biscuits) stay unscored instead of being reclassified from a guessed name. A sugar-containing compound still triggers the existing first-three cap.

All 1,047 single-blocker observations were assessed: 739 gained scores/ranges (412 complete, 327 provisional), 308 remain blocked. The baseline comparison checks all 4,102 observations plus four Shelf-demo records; no previously assessable result or demo assessment changes apart from the model ID. Missing fiber stays null, score weights/bounds/ceilings are unchanged, and source-zero guards apply to newly unlocked legacy categories too. The pass does not claim that all source tables or source categories are correct.

Reproduce with `npm run catalog:report:ingredient-impact -- --write`. The pinned Git baseline and evidence hashes prevent comparing changed source data as though it were a dictionary-only change. The full per-ID queue remains in the ignored report, not in user-facing cards.

The following **weights, linear curves, food-base points and 59-point ceiling are Sugar.no pilot design choices**, not WHO/EFSA recommendations or an official validated nutrition score. They must be versioned whenever changed. No universal “good food” cutoffs are shown.

| Product type | Sugar | Protein | Food base | Balance |
| --- | ---: | ---: | ---: | ---: |
| Chips; crackers/crispbreads; popcorn/savory snacks (separate groups) | 10 | 10 | 30 | 50 |
| Spoonable yogurt; dairy dessert (separate groups) | 30 | 25 | 20 | 25 |
| Ice cream | 35 | 15 | 25 | 25 |
| Snack bar; cookie/wafer (separate groups) | 30 | 20 | 25 | 25 |
| Dry breakfast cereals, muesli and granola (one separate group) | 30 | 20 | 25 | 25 |
| Bread | 15 | 15 | 30 | 40 |
| Pasta/noodles | 10 | 20 | 35 | 35 |
| Nuts/seeds | 10 | 20 | 30 | 40 |
| Dried fruit | 30 | 10 | 35 | 25 |
| Chocolate | 35 | 10 | 25 | 30 |
| Candy | 40 | 5 | 30 | 25 |
| Cheese | 5 | 25 | 25 | 45 |
| Prepared meat | 5 | 25 | 25 | 45 |
| Prepared fish | 5 | 30 | 25 | 40 |
| Sauces/spreads | 25 | 5 | 30 | 40 |

Each source category becomes exactly one rank group. The original seven mappings take precedence; new families are fallback-only so a chocolate cookie remains a cookie and a Rimi `batoniņi` item remains a bar. Drinks, infant food and broad ambiguous aisles stay unsupported. Category names are normalized across audited English, Latvian, Lithuanian and Russian source wording, while product-title translations are never used to choose the score profile.

Balance shares are category-specific. Chips/crackers/savory snacks use salt/saturates/fiber 50%/30%/20%; yogurt/dairy 35%/65%/0%; ice cream 20%/80%/0%; bars/cookies/cereals and dried fruit 20%/40%/40%; bread 50%/25%/25%; pasta about 41.43%/30%/28.57%; nuts 45%/30%/25%; chocolate/candy 10%/60%/30%; cheese/meat 55%/45%/0%; fish 60%/40%/0%; sauces 55%/35%/10%. Any category using fiber assigns at most ten total score points to it.

English package labels for eight Turtle SKUs are independently reviewed identity aliases, not ingredient translations. They require exact source URL/brand/pack/image metadata and reject extra unknown flavour tokens. Cinnamon Crunch and Bites are the brand's two labels on the same [English product page](https://turtlecereals.com/collections/cereal-classics/products/cinnamon-cereals) and [German product page](https://turtlecereals.com/de-de/kategorien/vegan/produkte/cinnamon-cereals); the checked Livinn 300g observation matches the disclosed composition/table. Other manufacturer tables are not merged into retailer observations; recipes may differ across markets or change over time.

Every component is normalized to 0–100, then multiplied by its weight/100. Component contributions are rounded to one decimal; integer tenths are summed before final rounding to avoid binary half-point errors. Existing regression fixtures preserve the original seven profiles. Missing-fiber bounds remain at most ten points apart; a ceiling can collapse them to one displayed value, still explicitly provisional.

- Sugar: 100 points at ≤5 g/100 g, linear to 0 at ≥22.5 g/100 g. These are **total** sugars; dairy lactose and added sugars are not numerically separated. Ingredient evidence provides a separate explicit sugar/honey/syrup signal.
- Protein: percentage of energy from protein = `protein g × 4 / kcal × 100`; linear from 0 to 100 points at 20% energy, capped there. Grams and energy percentage are disclosed; high grams per 100 g alone do not guarantee the highest score.
- Food base: recognized whole-grain/legume/nut base 100; milk/yogurt base 85; potato/corn base 75; refined flour/rice/starch/isolated protein or explicit chocolate-compound base 25; sugar/honey/syrup first 0. The new families additionally recognize explicit whole tomato, dried fruit, cocoa mass and animal/cheese bases, and explicit semolina/gelatin refined bases. Prepared meat/fish receives at most 70 food-base points below 80% declared animal base and at most 40 below 50% or when mechanically separated. Unknown or oil-first bases are unscored, not bad by default. Sugar/honey/syrup in the first three top-level ingredient groups, including compound ingredients, limits this component to 40. This is ingredient-order evidence, **not** an estimate of added sugar grams.
- Balance: salt scores 100 at ≤0.3 g, linear to 0 at ≥1.5 g; saturates 100 at ≤1.5 g, linear to 0 at ≥5 g; fiber is linear 0–6 g to 0–100 points. Category shares are listed above. All values are per 100 g.
- If sugar **>22.5 g**, salt **>1.5 g** or saturates **>5 g** per 100 g, overall score cannot exceed **59/100**. The UI names the limiting nutrient. This ceiling prevents protein from fully compensating for a limiting nutrient; 59 is a provisional product-policy value, not a medical boundary.

The low/high sugar, salt and saturate anchors come from the [NHS food-label guide](https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/how-to-read-food-labels/). The [EU nutrition-claims regulation, Annex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006R1924) uses 12%/20% energy for source-of/high-protein claims and 3/6 g fiber per 100 g (or energy-based alternatives) for fiber claims. Those references do **not** validate this ranking formula. The UI's low-protein/fiber notices describe numeric anchors, not a claim of legal certification.

There is no additive-count or ingredient-count penalty. Sweeteners are disclosed without a blanket safety penalty. Organic, gluten-free, high-protein or no-added-sugar marketing does not supply missing evidence. The model does not calculate NOVA, a toxin score, calorie allowance or an individual health prediction. A chip can be a higher-ranked chip without becoming an unlimited everyday recommendation; portion size and the overall diet still matter.

## Baseline and batch reproducibility

The original 198-row snapshot was obtained through two bounded public-page batches. It is a historical baseline, not current coverage. The accelerated rollout reads known URLs only in the nineteen supported categories, one worker per source, with no search/model calls. Rimi, Barbora and Livinn retailer observations stay separate from the OFF ODbL file/table. Any HTTP 429 stops that source queue and saves an absolute cooldown; checkpoints allow explicit later resumption after that boundary. A failed source or changed SKU cannot overwrite older evidence. No scheduler or background crawler is created.

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

Current checked-in coverage is 5,150 exact source observations: 1,343 complete scores, 2,369 provisional ranges and 1,438 unscored observations. Across the full 20,120-row source inventory, 3,712 rows are assessable, 3,605 are in supported types but lack sufficient exact evidence, and 12,803 are outside the model. These are source rows, not globally deduplicated physical products or a recognition benchmark. The offline quality report flags candy's concentration in Low fit, low assessable coverage for ice cream, and bread ranges that often cross a presentation band. Never borrow another product's nutrients to improve coverage. Curated/demo/grounded-web identities without a separate compatible observation stay unscored in this pilot, even when they have original Fit.

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
npm run catalog:audit:personal-fit
npm run catalog:report:personal-fit
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
