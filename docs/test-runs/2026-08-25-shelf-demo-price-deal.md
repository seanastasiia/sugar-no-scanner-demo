# Shelf demo crossed-price release check

- Date: 2026-08-25, Europe/Riga
- Scope: make the guaranteed Shelf demo visibly demonstrate the investor-requested cheaper-online flow without weakening price trust for live scans.

## Evidence boundary

- The generated shelf scene does not contain a verified current physical-store price. The fixture therefore labels €3.49 as a `Demo shelf price`; it is interaction evidence, not a store-price claim.
- The exact Barbora page `prot-bat-sal-riekst-saldin-barebells-55-g` was read on 2026-08-25. Its public page reported the active Barebells Salty Peanut 55 g SKU at €2.79, €50.73/kg.
- Only that exact SKU receives the deterministic offer. The other three sample products remain unchanged.

## Intended behavior

1. `Shelf demo` resolves four rated products as before.
2. The leading compact Barebells card crosses out €3.49, shows `Barbora €2.79` and offers a 44 px `Buy cheaper` action to the exact product URL.
3. The expanded result says `Cheaper at Barbora`, labels €3.49 as `Demo shelf price`, shows €2.79 online and exposes the same exact link.
4. Live camera and saved-photo results still require a trusted physical price label plus an exact cheaper retailer match; no fallback or possible match may create the deal.

## Technical checks

- `npm test -- --run src/server/recognition.test.ts` — pass: 1 file, 18 recognition tests.
- `npm run test:e2e -- --grep "sample shelf photo"` — pass: 1 Mobile Safari scenario, including exact retailer URL, crossed-price CSS, 44 px CTA and automated WCAG A/AA audit. The first run exposed insufficient contrast on the crossed price; its foreground was corrected from `#817970` to `#6d665e` before the passing rerun.
- `npm run verify` — pass: ESLint, TypeScript, 20 Vitest files / 109 tests, production Next.js build and standalone asset preparation.
- `CI=1 npm run test:e2e` — pass: all 21 Mobile Safari scenarios, including narrow portrait, landscape, iPhone 17 Pro, reduced motion, enlarged text, dark mode and accessibility coverage.
- `git diff --check` — pass.
- Visual evidence inspected at the original 1170 × 1992 size: `docs/screenshots/shelf-mobile.png` and `docs/screenshots/shelf-results-mobile.png`. The compact preview shows the crossed demo value and retailer CTA without obscuring the camera; the expanded best-first list preserves the same two prices on the exact Barebells row.

## Production release

- Behavior commit: `122cc7a3dd014b3c811c3ca988751fd65027cd6d`, pushed to GitHub `main`.
- Direct Railway deployment: `98757f8a-6101-4ed0-81eb-281e93f32b5b` — `SUCCESS`.
- `GET /api/health` — pass: `status=ok`, `commit=122cc7a3dd014b3c811c3ca988751fd65027cd6d`.
- Production `POST /api/recognize` with `source=sample-shelf` — pass: four detections; the first exact Barebells SKU returns `Demo shelf price €3.49`, exact retailer offer €2.79 and the verified Barbora product URL.
- Production browser smoke — pass: compact sheet reports `4 products · 4 with Sugar.no fit`; €3.49 is visibly `line-through`, €2.79 is visible and `Buy cheaper` points to the exact product page.

## Product check after deployment

1. Open production, tap `Show demo`, then `Shelf demo`.
2. Confirm the leading compact product has a visible line through €3.49 and a separate €2.79 Barbora price.
3. Confirm `Buy cheaper` is immediately tappable and opens the Barebells Salty Peanut 55 g Barbora page.
4. Open `View all`; confirm €3.49 alone remains crossed out and is explicitly identified as a demo shelf price.
5. Confirm all four Sugar.no fit markers and best-first product ordering remain unchanged.
