# Better alternatives release check — 2026-08-26

## Scope

- Replace broad `Similar options` with fail-closed `Better alternatives`.
- Require exact type/subcategory/form, equal-or-better fit and current exact Barbora availability.
- At equal fit, order by lower current price and then closest pack size.
- Hide the block when no valid substitute is available.

## Technical checks

Code commit: `5d8877d01d507b254ab6ba9c7c99de5e8ea0895a`.

- Related Vitest files: **33/33 passed**.
- `npm run verify`: **passed** — lint, typecheck, **141/141 unit/integration tests**, production build and standalone asset preparation.
- `CI=1 npm run test:e2e`: **25/25 Mobile Safari scenarios passed**.
- Railway build and `/api/health`: recorded after the production deployment below.

## Owner product check

1. Scan or open one mustard, protein bar or yogurt with a complete Sugar.no fit.
2. Expand the product and confirm the heading says `Better alternatives`.
3. Confirm every card is the same product type, has an equal or better fit and shows a current Barbora price.
4. Open a product without an exact substitute and confirm the entire block is absent.
