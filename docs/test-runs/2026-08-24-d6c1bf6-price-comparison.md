# Release verification: product-level Barbora price comparison

- Application code commit: `d6c1bf6924178fd62958abd7273c246014183b20`
- Branch: `main`
- Production URL: `https://sugar-no-scanner-demo-production.up.railway.app`
- Verification date: 2026-08-24, Europe/Riga

## Technical verification

`npm run verify`

- ESLint: pass
- TypeScript: pass
- Vitest: 11 files, 45 tests passed
- Next.js production build: pass
- Standalone assets preparation: pass

`CI=1 npm run test:e2e`

- Playwright Mobile Safari: 13/13 passed without retry.
- A trusted €1.69 shelf label appears beneath the recognized product in the compact result preview.
- An exact current Barbora offer of €0.99 produces `Cheaper at Barbora`, crosses out only €1.69, states `€0.70 less` and exposes the exact `Buy cheaper at Barbora` link.
- A non-exact retailer candidate leaves €1.69 intact and exposes no retailer link.
- With no physical shelf label, no price preview, comparison card or retailer-price prompt appears.
- `Data sources and limits` and `How this result was made` are absent from current product results.
- Dark mode, reduced motion, 125% text, narrow portrait, phone landscape and automated WCAG A/AA scenarios passed.

## Visual verification

- `docs/screenshots/price-comparison-mobile.png`: the trusted deal card clearly separates the crossed-out scanned shelf label from the current Barbora price and one primary retailer action.
- `docs/screenshots/barbora-quick-view-mobile.png`: the visible source/limits accordion is gone while the source-backed Sugar.no quick view remains.
- The comparison is expressed with text and numbers in addition to color, and all actionable targets retain at least 44 px height.

## Product checks for the owner

1. Scan or upload a product together with one clearly associated physical EUR shelf label.
2. Before expanding the result, confirm its camera-read price appears beneath the recognized product.
3. Expand the result. If the exact same Barbora SKU and pack size is cheaper, confirm the shelf price is crossed out and the button says `Buy cheaper at Barbora` with the lower price.
4. Open the button and confirm brand, variant and pack size match the recognized package.
5. Scan the package without a shelf label and confirm the app does not invent or show a comparison.
6. Confirm there is no visible `Data sources and limits` or `How this result was made` accordion.

## Production verification

- Pending Railway deployment, health check and authenticated production WebKit smoke.
