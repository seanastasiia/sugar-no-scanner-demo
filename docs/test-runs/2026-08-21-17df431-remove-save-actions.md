# Release verification: remove scanner save actions

- Application code commit: `17df431443d875b0ab45df4b24b41fde42ca8ff1`
- Branch: `main`
- Production URL: `https://sugar-no-scanner-demo-production.up.railway.app`
- Verification date: 2026-08-21, Europe/Riga

## Technical verification

`npm run verify`

- ESLint: pass
- TypeScript: pass
- Vitest: 11 files, 45 tests passed
- Next.js production build: pass
- Standalone assets preparation: pass

`CI=1 npm run test:e2e`

- Playwright Mobile Safari: 13/13 passed without retry.
- Shelf and checkout results contain no button with an accessible name matching `Save`.
- The former `Saved options` section stays absent after leaving the scanner.
- A legacy `sugarno.saved-products.v1` local-storage value does not restore the removed interface.
- Dark mode, reduced motion, 125% text, narrow portrait, phone landscape, camera, checkout, price, privacy, Barbora quick view and axe coverage passed.

## Visual verification

- `docs/screenshots/shelf-results-mobile.png`: the product header no longer contains a Save button and the Similar options cards use the reclaimed space without a blank action area.
- `docs/screenshots/checkout-mobile.png`: checkout retains the camera-first comparison pattern without a save prompt.
- `docs/screenshots/barbora-quick-view-mobile.png`: the on-demand Barbora result retains its rating and retailer action without a Save control.
- The old `docs/screenshots/saved-next-shop-mobile.png` evidence was removed because that product state no longer exists.
- Price-comparison copy such as `Save €0.70` remains only when it describes a verified price difference; it is not a product-save button.

## Product checks for the owner

1. Open Shelf photo and expand the product results.
2. Confirm there is no Save button on the selected product or Similar options.
3. Switch to Checkout and confirm there is no `Save for next shop` action.
4. Close and reload the scanner; confirm no `Saved options` section appears, including in a browser that used an older build.
5. Confirm Similar options and the exact Barbora action are still available.
6. If a verified cheaper-price comparison appears, confirm `Save €…` is explanatory price text rather than a button.

## Production verification

- Pending Railway deployment, health check and authenticated production WebKit smoke.
