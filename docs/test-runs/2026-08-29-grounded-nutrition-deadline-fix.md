# Grounded nutrition deadline regression fix

Date: 2026-08-29

## Production diagnosis

Railway runtime logs showed every unfamiliar-product web enrichment failing before search with Google HTTP 400: the configured 6-second deadline was below the provider's supported 10-second minimum. This made complete product identities fall directly to `Nutrition not verified online` even when a grounded source could have existed.

## Fix

- Grounded nutrition now defaults to a 12-second deadline.
- Environment overrides are clamped to the supported 10-to-30-second range.
- A regression test covers the default, the old 6-second value, a valid override, invalid input and the upper bound.
- A fresh Railway deployment clears the process-local 30-minute miss cache created by the broken requests.

## Local technical verification

- `npx vitest run src/server/web-nutrition.test.ts`: 4/4 passed.
- `npm run verify`: ESLint passed; TypeScript passed; 35 Vitest files and 195 tests passed; Next.js production build passed.
- `CI=1 npx playwright test --reporter=line`: 28/28 Mobile Safari scenarios passed.
- `npm run catalog:validate`: passed; 40 curated, 18,554 Barbora, 6,822 complete Rimi, 6 Livin and 500 Open Food Facts records were readable.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `git diff --check`: passed.

## Product verification

1. Scan the same shelf containing complete unfamiliar product identities such as Maggi or Oyakata.
2. Confirm products appear immediately as identified while exact nutrition resolves in the background.
3. Confirm the result no longer becomes unverified because of an immediate provider HTTP 400.
4. Keep products neutral when no exact, cited nutrition source can be confirmed; the fix restores the search path but does not invent nutrition.

## Production evidence

To be completed after the GitHub `main` push and Railway deployment.
