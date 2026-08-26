# Compact control and marker-size cleanup

Date: 2026-08-26
Feature commit: `213143ca9c54a6c3358d24c11ddbbfc78932d665`

## Change under test

- Removed the compact result sheet's secondary `Scan again` icon, leaving `View all` as the only sheet action.
- Reduced yellow `Moderate fit` visual discs to 38 px, or 42 px for the best marker. The outlined product button retains its minimum 44 px touch target.

## Technical verification

- `npx eslint src/components/scanner-app.tsx tests/e2e/scanner.spec.ts`: pass.
- `npm run typecheck`: pass.
- Shelf-marker and iPhone viewport regressions: 2/2 Mobile Safari pass.
- `CI=1 npm run test:e2e:smoke`: 4/4 Mobile Safari pass.
- `npm run build`: pass; standalone assets prepared.
- `git diff --check`: pass.
- Visual QA: `docs/screenshots/shelf-mobile.png` shows one compact `View all` action and visibly smaller yellow discs without changing the product outlines.

## Product check

1. Open `Show demo` and choose `Shelf demo`.
2. Confirm the compact sheet contains `View all` but no circular refresh button.
3. Confirm yellow minus markers cover less of their packages and tapping anywhere in the outlined package still opens that product.
