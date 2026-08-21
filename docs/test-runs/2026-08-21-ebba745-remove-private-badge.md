# Release verification: remove the Private demo header badge

- Application code commit: `ebba7451c12e3f2b75f69b5f8038b00b0e1d0e46`
- Branch: `main`
- Production URL: `https://sugar-no-scanner-demo-production.up.railway.app`
- Verification date: 2026-08-21, Europe/Riga

## Technical verification

`npm run verify`

- ESLint: pass
- TypeScript: pass
- Vitest: 12 files, 48 tests passed
- Next.js production build: pass
- Standalone assets preparation: pass

`CI=1 npm run test:e2e`

- Playwright Mobile Safari: 12 passed and one passed on its configured retry.
- The private gate rejects a wrong code and accepts the configured code.
- After authentication, exact text `Private demo` has a count of zero.
- Shelf, checkout, saved flow, upload, live camera, on-demand Barbora rating and accessibility coverage completed.
- The existing live-camera timing scenario did not find its status within 10 seconds on its first attempt, then passed on retry. It was immediately rerun alone with retries disabled and passed in 8.0 seconds.

`CI=1 npx playwright test tests/e2e/scanner.spec.ts --project='Mobile Safari' --grep='live camera groups repeated packs' --retries=0`

- Live-camera timing scenario: 1/1 passed without retry.

## Visual verification

- `docs/screenshots/shelf-mobile.png`: scanner header contains only the Sugar.no wordmark; the former right-side badge and its reserved layout space are gone.
- `docs/screenshots/checkout-mobile.png`: the same brand-only header is retained in checkout mode.
- `docs/screenshots/saved-next-shop-mobile.png`: the entry flow keeps the brand-only header after returning from a scan.
- Existing safe-area padding, camera controls and the access-code gate are unchanged.

## Product checks for the owner

1. Open the production URL and enter the investor access code.
2. Confirm the start screen header shows only `Sugar.no` and no `Private demo` badge.
3. Open Shelf, Checkout and Live camera; confirm the top-right camera area is clear.
4. Open the URL in a fresh private tab and confirm the access-code page still protects the app.

## Production verification

Pending the Railway deployment of this release evidence commit.
