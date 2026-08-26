# Saved-photo source badge removal

Date: 2026-08-26  
Feature commit: `7b2daccfe1e960c10873241cb7492401c34f9d23`

## Change under test

The saved-photo scanner no longer repeats `Saved shelf or checkout photo` in a large top-left badge. The existing `Back to live` action remains at the top right without leaving an empty layout gap.

## Technical verification

- `npx eslint src/components/scanner-app.tsx tests/e2e/scanner.spec.ts`: pass.
- `npm run typecheck`: pass.
- Saved-image unavailable regression: 1/1 Mobile Safari pass.
- Rated saved-photo price-comparison regression: 1/1 Mobile Safari pass.
- `CI=1 npm run test:e2e:smoke`: 4/4 Mobile Safari pass.
- `npm run build`: pass; standalone assets prepared.
- `git diff --check`: pass.
- Visual QA: `docs/screenshots/price-cta-compact-mobile.png` shows only `Back to live` in the saved-photo top overlay.

The first price-comparison run exposed a stale test string: the current status is `1 product · 1 with Sugar.no fit`, while the assertion expected the older wording. The assertion was updated and the scenario then passed.

## Production verification

- `GET /api/health`: HTTP 200, `status: ok`, commit `7b2daccfe1e960c10873241cb7492401c34f9d23`.
- A production WebKit upload smoke at 393×852 found zero visible source badges, one visible 44 px-high `Back to live` control aligned at the right, and no page-level horizontal overflow.

## Product check

1. Open `Show demo` and choose `Use saved photo`.
2. Select any shelf or checkout image.
3. Confirm the former source badge is absent and `Back to live` remains in the top-right corner.
