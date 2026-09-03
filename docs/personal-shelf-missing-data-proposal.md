# Missing-data policy — accepted v1.1

Status: owner accepted; implemented as `personal-shelf-v1.1-bounded`, 3 September 2026. The baseline analysis below is preserved for provenance, not as the current database count. Production rollout checks are in [the dated log](test-runs/2026-09-03-personal-shelf-batch-rollout.md).

## Product rule

Missing optional data can produce a provisional assessment, not an invented nutrient value or an automatic rejection. Missing essential data and contradictory data are different states and retain stronger restrictions.

1. **Complete evidence:** keep the full category-specific assessment.
2. **Only fiber is absent:** keep the other weights fixed and expose the range of possible scores. Fiber contributes from 0 to 10 points in the currently supported non-dairy categories. Calculate the contribution from known fields, then the upper bound with the maximum fiber contribution. Apply the same limiting-nutrient ceilings to both bounds. Example only: 72 confirmed points plus an unknown 0 to 10 point contribution becomes `72-82/100`, not a precise 80 after scaling 72/90 to 100.
3. **Missing essential information:** exact product identity, a dated compatible source, a supported unambiguous category, interpretable ingredients, energy, protein, sugar, salt and saturated fat remain required for an overall Personal Shelf assessment. Otherwise show available facts; original Sugar + Protein Fit can remain available only when its own exact-data requirements are met. Do not silently substitute a nutrition-only result for a composition rating.
4. **Invalid or contradictory evidence:** no overall score or numeric rank. An impossible table, conflicting identity, negative/non-finite value or unsupported basis is not equivalent to an omitted optional field.

The stored fiber value remains null. The endpoint calculations represent possible point contributions, not an estimate that the food contains 0 g or 6 g fiber. No category average, similar product, translated title or missing-as-zero source value is stored. Dairy categories continue to exclude fiber entirely.

## Ranking and compact disclosure

For category-local ordering, use the lower bound as a cautious sorting rule, not an assertion about the true best product. Show the interval and identify the assessment as provisional. If intervals overlap, do not present their ordering as a verified winner; any displayed place must be marked provisional. Keep the explanation inside the card. Knowing 90% of the model's weight is not a statistical 90% confidence level.

Do not generalize this exception to every missing field. In particular, omitting sugar, salt or saturated fat could hide an existing score ceiling. Adding other optional signals requires a separate sensitivity check and a versioned policy decision.

## Evidence and read-only checks

The [European Commission nutrition-labelling guidance](https://food.ec.europa.eu/food-safety/labelling-and-nutrition/food-information-consumers-legislation/nutrition-labelling_en) lists fiber as a voluntary addition to the usual mandatory nutrition declaration. Its omission is not evidence that a product contains no fiber. The proposed 10-point bounds and conservative sort are Sugar.no product choices, not an official nutrition or medical scoring standard. The [OECD/JRC composite-indicator handbook](https://www.oecd.org/en/publications/handbook-on-constructing-composite-indicators-methodology-and-user-guide_9789264043466-en.html) provides general guidance on examining the effects of missing data, weights and uncertainty; it does not validate this food-ranking model.

Read-only assessment of the unchanged 198-record snapshot on 3 September 2026, checkout `b9e2ea30fcb22ca8f1fb788f11d86c83bebb71bd` (application commit `5f7198e728499c4fccbe3cbef7f5f3cbc75f7e5e`):

- 64 complete scores.
- 82 records blocked only by an absent fiber value: 14 chips, 23 crackers, 19 bars and 26 cookies.
- 52 records still blocked by other missing, ambiguous or contradictory evidence.
- Potential displayable assessments: 146/198, comprising 64 complete scores and 82 provisional intervals. This is not a claim of 146 complete records or improved camera recognition.
- Masking fiber on the 33 already complete non-dairy records: the current formula's low/high endpoints enclosed all 33 known scores. Naive whole-score renormalization to 100 raised 3 of those known product scores without adding evidence.
- The analysis found a rounding edge: synthetic fiber endpoints for `livinn_lt:1AM070101204` gave 14 and 25 despite a 10-point component difference. v1.1 sums integer tenths before final rounding and regression-tests the correction. A direct old/new comparison preserved all 64 complete baseline scores; the previously absent-fiber record gains only a provisional range, not an invented source value.

## Acceptance checks

Technical: preserve exact-identity/source/contradiction checks; prove null fiber remains null; ensure bounds contain the corresponding complete score; removing known fiber must not raise the lower bound; preserve score ceilings at both endpoints; test zero versus absent versus invalid input, rounded boundaries, ties and overlapping intervals. Audit complete-score changes caused by the rounding fix. These checks are implemented in unit tests and the snapshot validator; browser and release results are logged separately.

Owner: compare one complete product with one fiber-missing product; confirm the interval and provisional place are understandable without opening a long explanation; confirm a salt-missing or contradictory product does not look fully rated. The production feature remains opt-in and can be disabled with `PERSONAL_SHELF_RANK_ENABLED=false`; replacing default Fit still requires separate approval and real-package validation.
