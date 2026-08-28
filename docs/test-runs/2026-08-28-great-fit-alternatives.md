# Great-fit-only alternatives release check

Date: 2026-08-28  
Tested code commit: `bece415dab46c9b5bac5cee7682a497feae2f31a`  
Target: Railway production, Mobile Safari-first

## Change

- `Better alternatives` accepts only exact substitutes rated `Great fit`.
- The candidate must still be no worse than the selected product and have a current exact retailer offer.
- `Moderate fit`, `Low fit` and unrated candidates are rejected. If no qualifying candidate remains, the section is not rendered.

## Technical verification

- Focused Vitest: passed — 38/38 alternative, scoring and indexed-catalog tests.
- `npm run check:fast`: passed — ESLint, TypeScript and 162 Vitest tests.
- Targeted shelf Playwright scenario: passed — 1/1 Mobile Safari scenario.
- `npm run verify`: passed — ESLint, TypeScript, 162 Vitest tests and Next.js production build.
- `CI=1 npm run test:e2e:smoke`: passed — 4/4 Mobile Safari scenarios.
- `git diff --check`: passed.

## Product verification after deploy

1. Open Shelf demo and choose a rated product.
2. Expand `View all` and scroll to `Better alternatives`.
3. Confirm every visible alternative has the green `Great fit` label.
4. Open a product without a qualifying exact substitute and confirm the entire alternatives section is absent.
