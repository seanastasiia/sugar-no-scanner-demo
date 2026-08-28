# Full-width cheaper-online action verification

- Date: 2026-08-28
- Code commit tested: `fb78f495e6ab8a979041a5fadd37fc0b7e20a5bf`
- Base: GitHub `main` at `8efe9a1`
- Target: Mobile Safari layout and exact connected-retailer price actions

## Technical checks

- `npm ci`: pass, 0 vulnerabilities.
- `npm run verify`: pass.
  - ESLint: pass.
  - TypeScript: pass.
  - Vitest: 29 files, 153 tests passed.
  - Next.js production build: pass.
- `npx playwright test tests/e2e/scanner.spec.ts --grep "sample shelf photo highlights|a rated product receives an honest price comparison"`: 2 Mobile Safari tests passed.
- Visual QA: the exact cheaper offer renders as one green, full-width, 44 px-or-taller `Buy cheaper online` action with the destination price at the right. The crossed shelf price remains above it and visible `Barbora online` copy is absent.
- Accessibility: the existing exact-retailer destination remains in the link's accessible label; the shelf E2E axe check passed.

## Product checks

1. Open Shelf demo and tap `View all`.
2. Confirm the first product crosses out the higher shelf price.
3. Confirm its green `Buy cheaper online` action fills the product card width and shows the lower price at the right.
4. Confirm products without a verified saving use the neutral `Buy online` action.
5. Confirm `Barbora online` is not displayed beside product prices.
