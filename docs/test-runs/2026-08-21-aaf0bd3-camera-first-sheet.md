# Release verification: camera-first expandable results

- Application code commit: `aaf0bd301cca48f7d2eb8746772aa3c2f6b54fb1`
- Branch: `main`
- Production URL: `https://sugar-no-scanner-demo-production.up.railway.app`
- Verification date: 2026-08-21, Europe/Riga

## Technical verification

`npm run verify`

- ESLint: pass
- TypeScript: pass
- Vitest: 11 files, 40 tests passed
- Next.js production build: pass
- Standalone assets preparation: pass

`CI=1 npm run test:e2e`

- Playwright Mobile Safari: 12/12 passed
- The 375×812 responsive scenario asserts that the camera stage occupies at least 95% of the browser viewport.
- The populated-shelf scenario waits for the expanded results dialog to occupy at least 95% of the iPhone viewport after its transition.
- Shelf and checkout both use the compact thumbnail sheet before the full comparison page.
- Generic identified products remain available in the sheet but receive no camera marker unless verified nutrition produces a Sugar.no rating.
- Reduced motion, dark mode, enlarged text, phone landscape, result holding, retry, privacy and automated WCAG A/AA scenarios remain green.

## Visual verification

- `docs/screenshots/shelf-mobile.png`: full-viewport camera, rated shelf overlays and compact product sheet.
- `docs/screenshots/shelf-results-mobile.png`: expanded full-height result page with legend, product tabs, Sugar.no badge and Similar options.
- `docs/screenshots/checkout-mobile.png`: the same compact-sheet interaction over the checkout photo.
- Product thumbnails are real catalog images; the Next.js development indicator is disabled so it cannot contaminate evidence screenshots.

## Product checks for the owner

1. Open Shelf photo on iPhone Safari and confirm the camera scene feels primary.
2. Tap `View products` or the list icon and confirm the sheet becomes a full page.
3. Collapse it and confirm the held shelf returns without rescanning.
4. Scan an unverified Latvian product and confirm it is named in the sheet but receives no gray `i`, check, minus or alert marker on the camera.
5. Confirm the same behavior in Checkout and with reduced motion enabled.

Physical Latvia shelf accuracy and broad sourced rating coverage remain separate, uncompleted validation work; deterministic sample scenes are not an accuracy benchmark.
