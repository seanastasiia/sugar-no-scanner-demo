# Stockmann Personal Shelf photo QA — 8 September 2026

## Scope

Two owner-supplied dense Stockmann shelf photos previously ended in `No rated products in this scan` when Personal Shelf Rank was enabled: one snack/protein-bar shelf and one national-cuisine sauce shelf. The change adds exact-source coverage and strict identity/category recovery for visible products without changing the Personal Fit formula or accepting model-generated nutrition.

## Source and matching safeguards

- Added 19 whole Rimi/Barbora source observations; no nutrient field is joined from another product or source.
- Reviewed English package labels are pinned to exact source, SKU, brand, pack and source title.
- Broad retailer aisles become a supported Personal Shelf category only for reviewed exact product IDs.
- A curated card is promoted to a Barbora evidence ID only when its retailer URL is a direct canonical HTTPS Barbora product URL.
- A provable kJ/kcal unit-label transposition is corrected only when both source numbers agree within 5% after conversion.
- In sauces, exact water-only first ingredients use the next listed ingredient as the food base, while added-sugar checks keep the original ingredient order.
- Missing, contradictory or unit-incompatible evidence remains unknown and is not displayed as a rating.

## Real-photo product checks

The same local recognition/enrichment path used by the scanner was replayed against both owner photos. Images were not copied into the repository or QA report.

- Snack shelf: repeated runs returned five rated products. Retained examples included both Nutego Protein Bar flavours, NICK'S Peanuts & Fudge, Pure Chocolate protein truffle and The Beginnings Flapjacks flavours. The exact five can vary because the dense image retains at most ten recognition detections.
- Sauce shelf: the replay returned rated Santa Maria Wok Pad Thai and Blue Dragon Hoisin & Garlic instead of an empty Personal Shelf state.
- Unsupported volume-only or incomplete products remained hidden rather than borrowing a 100 g conversion or another flavour's nutrition.

This is a two-photo regression check, not a store-wide recognition benchmark.

## Technical verification

Verified locally on branch `codex/demo-button-row-preview`, based on `be79bb9` before release:

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run catalog:validate:shelf-pilot` — passed with 7,512 observations: 2,334 complete and 3,426 provisional.
- `npm run catalog:audit:personal-fit` — passed with 20,120 source records accounted for and 5,760 assessable rows.
- `npm run verify` — passed: lint, typecheck, 77 Vitest files / 701 tests, all catalog validators and the production build.
- Targeted Stockmann/parser/resolution Vitest suite — 7 files and 238 tests passed.
- Three targeted Mobile Safari scenarios passed: Personal Shelf rendering, one-line Protein/Sugar/Carbs nutrition layout and full-screen camera/demo-control layout.
- `railway run npm run build` — the independent production build also passed with preview environment variables.
- `git diff --check` — passed.

## Production release

- Application commit: `c5e9d020f0214a90f188d47f4e096b3c7ca658c1` on GitHub `main`.
- Railway production deployment: `146fb719-c8b3-47cf-a1d7-d18763cd8ed6`, status `SUCCESS`.
- Live `/api/health` returned the exact application commit and 7,512 Personal Shelf observations: 2,334 complete, 3,426 provisional and 1,752 unscored.
- Production `/` and `/demo/personal-shelf` both returned HTTP 200.
- Immediate rollback tag: `production-before-stockmann-personal-rank-2026-09-08` at `be79bb9`.

## Owner acceptance

1. Upload the snack-bar photo, open `View all`, and enable `Personal Shelf Rank`.
2. Confirm the result contains rated Nutego, NICK'S, Pure Chocolate or Flapjacks cards instead of the empty state. The exact subset may vary with the ten-product recognition cap.
3. Upload the sauce photo and repeat. Confirm Santa Maria Pad Thai and/or Blue Dragon Hoisin & Garlic receive a Personal Shelf rating.
4. Confirm products without sufficient exact evidence are absent rather than shown with invented nutrition.
