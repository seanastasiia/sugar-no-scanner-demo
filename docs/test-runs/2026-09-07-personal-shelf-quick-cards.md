# Personal Shelf quick-card redesign — preview QA

Checked: 2026-09-07

## Scope

- Branch: `codex/personal-fit-catalog-preview`.
- Replace visible category headings with one `Best product`/`Best products` heading and keep category inside each card.
- Keep card surfaces neutral; color only the labelled Great/Moderate/Low gradient badge.
- Show exact score, meaningful within-category rank, sugar, protein and one short product-specific reason.
- Replace repeated per-card breakdowns with one closed `How scores work` disclosure.
- Do not change evidence, score computation, ordering, recognition, camera markers or original Fit.

## Technical checks

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Focused Personal Shelf Mobile Safari: 7/7 passed, including category-local ranking, exact Livinn observations, dark mode, 200% text, landscape and unchanged original Fit.
- Standalone rating-demo Mobile Safari: 4/4 passed after the shared badge/card-surface change.
- `npm test`: 75 files / 670 tests passed after the accessible gradient adjustment.
- `npm run build`: passed, including standalone asset preparation.
- Final visual rerun: 2/2 scanner card scenarios and 1/1 standalone rating-demo scenario passed in Mobile Safari.

## Owner check

1. Upload a shelf photo, open `View all` and enable `Personal Shelf Rank`.
2. Confirm the result starts with `Best product` or `Best products`, with no category heading above the cards.
3. Confirm category is inside each white card and only the Fit badge is colored.
4. Check the score, rank, sugar, protein and one short `Why …` line at a glance.
5. Open the single `How scores work` disclosure, then switch Personal Shelf off and confirm original Fit is unchanged.
