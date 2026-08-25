# Camera overlay cleanup release check

- Date: 2026-08-25, Europe/Riga
- Scope: remove the redundant `2/2 signals` camera pill and white selected/best package frames without removing fit semantics or tap behavior.

## Product rule

- A rated package keeps its green, yellow or coral outline and icon.
- Tapping a package may reveal its `Great fit`, `Moderate fit` or `Low fit` label and select the matching result card.
- The camera never repeats `2/2 signals`; Protein and Sugar evidence remains in the compact and full comparison views.
- Selected and best packages do not add a white border or white outer ring.

## Technical checks

| Check | Result |
| --- | --- |
| `npm run verify` | Pass: ESLint, TypeScript, 20 Vitest files with 109 tests, Next.js production build and standalone preparation |
| `CI=1 npm run test:e2e` | Pass: 21 of 21 Mobile Safari scenarios in 56.7 seconds |
| Camera copy regression | Pass: camera overlay contains no visible `2/2 signals` and no `signals` text in marker accessibility names |
| Selected marker regression | Pass: after selecting a Moderate fit marker, its computed border and shadow contain no white frame or ring |
| Best marker regression | Pass: the best marker keeps its semantic fit-colored outline with no white border or outer ring |
| Accessibility and responsive coverage | Pass: automated WCAG A/AA, reduced motion, dark mode, enlarged text, 375 px phone, iPhone 17 Pro and phone landscape scenarios |

Visual evidence was regenerated in `docs/screenshots/shelf-mobile.png`, `docs/screenshots/iphone-17-pro-camera.png` and `docs/screenshots/iphone-17-pro-landscape.png`.

## Product check after deployment

1. Open the Shelf demo and tap several markers.
2. Confirm no marker shows `2/2 signals`.
3. Confirm every package outline remains its fit color before and after selection; no white selected or best frame appears.
4. Confirm the selected fit label and matching product card still update.
5. Open `View all` and confirm Protein and Sugar values remain available there.
