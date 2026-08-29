# Captured-frame and alternative-link release evidence

Date: 2026-08-29  
Target: iPhone Safari-first Railway investor demo

## Release scope

- Keeps result overlays attached to the exact camera frame submitted for recognition instead of drawing old coordinates over newer live video.
- Clears the frozen frame and all prior markers together on `Scan again`.
- Gives every strict `Better alternatives` candidate its own exact-price retailer link while preserving the existing Great-fit-only and exact-substitute guards.

## Technical verification

- `git diff --check` — passed.
- `npm run verify` — passed: ESLint, TypeScript, 40 Vitest files / 208 tests, and the Next.js production build.
- `CI=1 npm run test:e2e` — passed: 28/28 Mobile Safari scenarios, including iPhone 17 Pro layout, captured-frame lifecycle, alternatives and accessibility.
- `npm audit --omit=dev` — passed: 0 known production dependency vulnerabilities.
- GitHub commit, Railway deployment and live production checks are recorded in the release handoff after publication.

## Product verification

1. Point the live camera at several products and wait for rated result boxes.
2. Move the phone or close the shelf/fridge. The displayed photo and boxes must remain the same captured scene.
3. Tap `Scan again`. The snapshot and boxes must disappear together and the current live camera must return.
4. Open a result with `Better alternatives`. Every displayed alternative must be a Great-fit substitute with its own exact retailer price and online link.
