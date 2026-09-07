# Unverified-card filtering and LAKTO cherry lookup — preview QA

Checked: 2026-09-07

## Scope and release boundary

- Branch: `codex/personal-fit-catalog-preview`.
- Final scan results hide cards without a numeric, source-backed Sugar.no fit. A pending exact lookup remains visible as `Checking nutrition…` and disappears only when the lookup finishes without a rating.
- The LAKTO cherry yogurt lookup treats `17 g protein` as a nutrition claim rather than a pack size. When that claim is mixed with another likely neighboring size, pack evidence becomes unknown and the existing exact brand/variant and uniqueness-margin checks still apply.
- Production and `main` are unchanged.

## Root cause and exact evidence

- The reported vision label was `Lakto Protein Jogurts Ķiršu 17g Protein 330g`.
- `17 g` is the front-of-pack total protein claim: the exact 200 g product has 8.7 g protein per 100 g, or 17.4 g per pack.
- The local dated Barbora record is `jogurts-protein-lakto-kirsu-200-g`, with 74 kcal, 8.7 g protein and 9.1 g total sugar per 100 g.
- The same exact 200 g SKU is present in the Rimi snapshot as `rimi_lv:4010916` with the same core nutrition. No 330 g LAKTO cherry nutrition is used.
- Before the fix, strict quantity conflict correctly rejected the 200 g candidate. After sanitization, the exact cherry candidate scores 0.92 and the next LAKTO flavours score about 0.54, preserving a clear uniqueness margin.

## Technical checks

- `npx vitest run src/lib/rating-visibility.test.ts src/server/recognition.test.ts`: passed, 42 tests.
- Focused Mobile Safari Playwright run covering pending visibility, final miss removal, mixed rated/unrated scans and all-unverified scans: passed, 5 tests.
- `npm run verify`: passed. ESLint, TypeScript, 75 Vitest files / 670 tests, catalog integrity, Personal Shelf validation and the Next.js production build all passed.
- `CI=1 npm run test:e2e`: passed, 58/58 Mobile Safari scenarios. The first run exposed one obsolete assertion that expected a now-hidden unscored Livinn card; after aligning the assertion with the requested rated-only scan contract, the complete rerun passed.
- Railway deployment and live HTTPS smoke are recorded below after release.

## Owner product checks

1. Open the isolated preview and upload the same fridge photo.
2. During lookup, a candidate may briefly show `Checking nutrition…`; after lookup completes, no `Nutrition not verified` card should remain.
3. Confirm `Lakto Protein Jogurts Ķiršu 200g` appears with a numeric fit and the verified per-100 nutrition, not as `330g`.
4. Confirm products for which no exact nutrition is found are absent while other verified products remain visible and ranked.
