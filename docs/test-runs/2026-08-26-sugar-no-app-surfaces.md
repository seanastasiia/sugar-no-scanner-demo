# Sugar.no app surface alignment

Date: 2026-08-26
Feature commit: recorded after production deployment

## Change under test

- Replaced the website-heavy blue results treatment with the visual language visible in four supplied Sugar.no iOS screenshots.
- Results now use a cool light-gray canvas, white cards and sheets, subtle neutral separators, near-black hierarchy and restrained system blue for action/focus only.
- Fit pills are filled and text-labelled like the app while retaining independent Great, Moderate and Low semantics.
- Camera layout, recognition, ranking, nutrition and price logic are unchanged.

## Accessibility and contrast

- Ink/canvas: 16.81:1; ink/surface: 18.47:1; muted/surface: 5.45:1.
- Great/white: 5.79:1; amber/dark: 6.97:1; Low/white: 4.51:1.
- System blue remains an action/focus color; fit meaning is always repeated in text.

## Technical verification

- App-surface token contract and Shelf accessibility test: pass.
- Full `npm run verify`: pass — ESLint, TypeScript, 25 Vitest files / 135 tests and the production Next.js build all passed.
- Full `npm run test:e2e`: 25/25 Mobile Safari scenarios passed, including accessibility, reduced motion, dark mode, enlarged text and iPhone viewport checks.
- `git diff --check`: pass.
- Visual QA: Shelf camera and expanded ranking show gray app canvas, white cards, filled fit pills and one white/black selected row.

## Product check

1. Open `Show demo`, then `Shelf demo`; confirm the bottom sheet is cool gray and every result card is white.
2. Confirm cards use subtle gray separators rather than blue outlines/fills.
3. Tap `View all`; confirm the selected row stays white with one near-black outline.
4. Confirm Great, Moderate and Low remain labelled and visibly distinct.
5. Check the compact sheet and full comparison on a small and large iPhone in portrait and landscape; confirm no horizontal overflow.

## Production verification

- Pending GitHub `main` push and Railway health/smoke verification.
