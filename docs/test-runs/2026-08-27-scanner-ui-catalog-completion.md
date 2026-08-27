# Scanner UI and Latvia catalog completion — 27 August 2026

## Scope

- Raise one scan from five to ten distinct products across recognition, offers and UI.
- Remove the duplicate camera summary pill, duplicate `Best` label and standalone price-comparison panel.
- Keep online actions on the exact ranked product card, using `Buy cheaper` only when a trusted shelf price is higher than an exact online offer.
- Stop forcing a zoomed camera crop and preserve correct overlay coordinates for camera, upload and sample scenes.
- Fill missing packshots with a crop from the scanned scene rather than an empty grey square.
- Replace the tiny retailer fixtures with reproducible exact-source batches: Rimi, Livin and an isolated Open Food Facts Latvia layer.

## Technical checks

Validated product commit: `982f6a2a1b6d9646e3bb7dc43f14bbb15f2242dc`.

| Check | Result |
| --- | --- |
| `npm run verify` | Pass; ESLint, TypeScript, 29 test files / 150 tests and Next.js 16 production build |
| `npm run catalog:validate` | Pass; 40 curated products, Barbora index 18,554, Rimi 500, Livin 6, Open Food Facts Latvia 500 |
| `CI=1 npm run test:e2e` | Pass; 25/25 Mobile Safari scenarios in 52.4 seconds |
| Targeted offers/upload tests | Pass; 2 files / 8 tests |
| `git diff --check` | Pass |

The Mobile Safari suite covers iPhone 17 Pro, adjacent viewport sizes, portrait and landscape, enlarged text, reduced motion, dark mode, axe WCAG A/AA, camera permission failure, uploaded long images, shelf and checkout samples, privacy/no-image-storage and per-card retailer offers.

## Catalog evidence

| Layer | Complete checked-in rows | Notes |
| --- | ---: | --- |
| Curated investor products | 40 | All have the two required fit signals |
| Barbora product index | 18,554 | Private proof-of-concept retailer index |
| Rimi exact public pages | 500 | Complete nutrition and product images; public JSON-LD did not expose GTIN |
| Livin exact public food pages | 6 | Full 169-URL sitemap checked; most remaining URLs are cosmetics or localized duplicates |
| Open Food Facts Latvia | 500 | Complete nutrition, 500 GTINs, 386 images; isolated ODbL layer |

The health endpoint reports 9,707 active food products, 7,433 products with automatic fit and 2,073 packaged-snack/dairy investor-pack products. This is broader demo coverage, not a guarantee that every Latvia SKU can be recognized.

## Production evidence

- GitHub product commit: `982f6a2a1b6d9646e3bb7dc43f14bbb15f2242dc` on `main`.
- Railway deployment: `ce7a789c-b581-4449-8bb7-5015dd45405a` — success, Amsterdam region.
- `/api/health`: `status=ok`, matching product commit and catalog counts above.
- `/`: HTTP 200; `/manifest.webmanifest`: HTTP 200.
- Browser shelf smoke: four rated products, no duplicate `Best`, no standalone price panel, exact per-card Barbora action.
- Browser checkout smoke: three rated products, no stuck preload, ranked preview visible.
- Visual QA screenshots: `test-results/iphone-17-pro-camera.png` and `test-results/iphone-17-pro-results.png` (generated locally and intentionally gitignored).

## Product check

1. Open production in iPhone Safari and allow the normal rear camera.
2. Scan a shelf with more than ten visible packages; confirm no more than ten distinct products are returned and the view is not artificially zoomed.
3. Open Shelf demo; confirm the old black count pill and camera `Best` label are absent.
4. Expand `View all`; confirm each ranked card shows its fit and nutrition, and exact retailer actions live on the same card.
5. Confirm `Buy cheaper` appears only when the visible trusted shelf price is above the exact online price; otherwise the CTA says `Buy online`.
6. Confirm a product without a retailer packshot uses a cropped visual from the scan instead of a grey placeholder.
7. Open Checkout demo; confirm three products appear immediately and remain readable until a new scan.
8. Scan an unresolved product; confirm no price-only or invented-nutrition card is shown.

## External dependencies still requiring provider action

- FatSecret Premier, NIQ Brandbank and GS1 Latvia cannot be marked connected until the providers approve access and issue credentials or a data delivery.
- The evaluation requests are prepared in `docs/partner-data-requests.md` but have not been transmitted.
- Supabase persistence is implemented through migrations/seeding, but no production Supabase credentials are configured; the deployed demo currently reads the reproducible checked-in catalogs.
