# Personal Fit exact basis, internet pilot and range simulation — 8 September 2026

## Scope

Preview branch only. Production and the shared product database were not changed. The work started from `e931554b7589b7f36cdbc3aa17ac9b6571349a13` on `codex/personal-fit-catalog-preview`.

The three bounded changes are:

1. scoring-only conversion of exact per-100-ml observations when the same Rimi title states one package mass and volume;
2. a frozen 100-GTIN internet enrichment pilot with no promotion;
3. a read-only simulation of conservative score ranges for one missing Personal Fit input.

## Exact basis conversion

- Exact cohort: 178 Rimi ice creams.
- Method: `per 100 g = per 100 ml × package volume ml / package mass g`.
- Raw nutrition remains stored with `nutritionBasis: 100ml`; the stored conversion metadata includes method, source title, mass, volume and factor.
- Multipack ratios use one unit on both sides (`4×72 g / 100 ml` means 72 g per 100 ml). Conflicting pairs, volume-only declarations and density outside the wide physical guard are rejected.
- Outcome: 94 `unsupported → scored`; 84 `unsupported → missing_data` because a separate field remains missing or contradictory.
- Catalog after the pass: 7,493 observations, 2,332 complete, 3,371 provisional, 1,790 unscored; 5,703 assessable source records in the 20,120-row audit.

## 100-card internet pilot

The sample is frozen under `.catalog-sync/internet-pilot-2026-09-08/`: 53 supported GTIN identities with no evidence and 47 exact observations with one blocker; 19 Livinn and 81 OFF source identities. The pilot made no Supabase write and promoted zero records.

The exact OFF product endpoint was checked first. Grounded Google search ran only for unresolved rows and returned a candidate URL plus barcode; generated nutrient values were neither requested nor accepted. Final evidence still required an exact identity and a deterministic whole-page parser.

- 100/100 exact OFF requests completed after respecting two HTTP 429 pauses.
- 11 became assessable (9 complete scores and 2 existing fiber-bounded ranges).
- 56 exact OFF observations remained incomplete.
- 15 source responses were unavailable; 18 failed identity/source-quality checks.
- 90 grounded searches completed; 81 located an exact-barcode URL on an unreviewed or unsupported host, 7 found no exact URL and 2 failed deterministic page identity verification.
- Google added 0 assessable cards. This is an adapter/source-rights finding, not evidence that generated web numbers should be accepted.

## Provisional-range simulation

No runtime formula, weight, threshold, rank or UI rule changed. The simulation evaluates endpoints allowed by existing consistency guards. Contradictory tables, ambiguous product type, unknown category and missing exact identity are excluded rather than assigned ranges.

- Existing optional-fiber ranges: 3,371 simulated; 2,905 stay within one fit band and 466 cross a band.
- Newly simulated one-blocker records: 945.
- Safe single-band candidates: 417.
- Band-crossing candidates: 528; these cannot receive a confident colored fit from the missing value alone.
- New single-band candidates by blocker: recognized first ingredient 279; salt 73; saturated fat 30; ingredient language 21; sugar 7; energy 6; protein 1.

This result supports a later, separately approved provisional policy. It does not activate those 417 ranges.

## Technical checks

Commands used during implementation:

```text
npm run typecheck
npm run lint
npx vitest run src/lib/personal-shelf-basis-conversion.test.ts src/lib/personal-shelf-rank.test.ts src/server/personal-shelf-parser.test.ts src/server/personal-shelf-evidence.test.ts
npm run catalog:convert:personal-fit-basis -- --write
npm run catalog:audit:personal-fit -- --write
npm run catalog:validate:shelf-pilot
npm run catalog:pilot:personal-fit-internet -- plan|run|report
npm run catalog:simulate:personal-fit-ranges -- --write
```

The complete repository verification and final commit are recorded in the task handoff after the final test run.

## Owner checks after an explicitly approved preview publish

1. Open Personal Shelf Rank and scan an ice-cream package whose Rimi title shows both ml and g.
2. Confirm a newly eligible card shows values per 100 g and the detailed explanation discloses the exact mass/volume conversion.
3. Scan a liquid or ice cream with only ml; confirm it remains unrated rather than receiving an estimated density.
4. Compare a known complete non-ice-cream card before and after; score, fit badge and rank must be unchanged.
5. Confirm no new internet-pilot card appears merely because Google found a URL; only promoted, whole, verified observations may become shared cards.
