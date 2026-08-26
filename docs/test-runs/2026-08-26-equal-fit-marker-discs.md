# Equal fit-marker discs

Date: 2026-08-26
Feature commit: recorded after production deployment

## Change under test

- Green `Great fit`, yellow `Moderate fit` and red `Low fit` circles on camera and saved-photo overlays now use one 46 px visual diameter.
- The best result no longer changes the circle size; ranking remains visible through the fit label and ranked result sheet.
- The full detected-product outline remains the interactive button, so the minimum 44 px touch-target requirement is preserved.
- Recognition, fit calculation, nutrition, ranking and bounding boxes are unchanged.

## Technical verification

- `npm run check:fast`: pass, including ESLint, TypeScript and 25 Vitest files / 135 tests.
- Scoped Mobile Safari Shelf regression: pass; the four overlay discs were measured as `46x46`, `46x46`, `46x46`, `46x46`.
- `npm run test:e2e:smoke`: 4/4 Mobile Safari flows passed, covering public root, Shelf, Checkout and automatic online enrichment.
- Visual inspection of the generated Shelf screenshot: both green checks and both yellow minuses render at one diameter; selection and best status do not resize the disc.
- `git diff --check`: pass.
- Pending production Railway health and visual smoke.

## Product check

1. Open `Show demo` -> `Shelf demo`.
2. Compare the two green checks and two yellow minuses on the photo.
3. Confirm all four circles have the same diameter, including the selected or best result.
4. Tap a yellow marker near its edge and confirm the product still opens because the full product outline is tappable.
