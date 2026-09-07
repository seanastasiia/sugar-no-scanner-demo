# Recovery retry button production release - 7 September 2026

## Scope

- Production-only release from the current `main` baseline.
- Restyled `Not sure — try again` without changing its copy or retry behavior.
- Matched the Sugar.no Figma large tinted action: 56 px height, full pill radius, action-blue gradient, white gradient rim, rounded 17/22 px label and the shared action shadow.
- Kept `Show demo` as the black action and verified both recovery buttons have equal rendered heights.
- Personal Shelf Rank preview changes are not included.

## Technical checks

- `CI=1 E2E_PORT=3014 npx playwright test tests/e2e/scanner.spec.ts --grep "provider unavailability pauses live recognition"`: 1/1 passed. It verifies the blue gradient, 56 px height, equal height with `Show demo`, portrait/landscape containment, touch targets and no horizontal overflow.
- `npm run check:fast`: ESLint passed, TypeScript passed, 59 Vitest files and 410 tests passed.
- `CI=1 E2E_PORT=3015 npm run test:e2e`: 55/55 Mobile Safari scenarios passed.
- `npm run build`: Next.js 16.3.1 production build passed; 14 routes generated and standalone assets prepared.
- `git diff --check`: passed.

## Product check

1. Open production and trigger an uncertain or unavailable scan.
2. Confirm `Not sure — try again` is blue, reads as an action rather than an error, and is the same height as `Show demo`.
3. Tap `Not sure — try again` and confirm recognition starts again.
4. Open `Show demo` and confirm its existing behavior is unchanged.

## Production verification

- Application commit: `d03f295b6d22e9c1a1eecc29d98f05741f7ebec9`.
- Railway deployment: `ad10e8e6-8ded-4b47-b079-160ff26193e8` — `SUCCESS`.
- `https://sugar-no-scanner-demo-production.up.railway.app/api/health`: `status=ok` and exact commit `d03f295b6d22e9c1a1eecc29d98f05741f7ebec9`.
- Production root returned HTTP 200.
- Rollback tag: `production-before-retry-button-2026-09-07` → `ab813c710f41ee7423f19ff35acb95381140c98d`.
