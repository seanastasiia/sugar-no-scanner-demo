# Sugar.no Figma/Pen visual-system release — 2026-08-25

## Scope

- Preserve the previous production result through Git tag `pre-pen-style-2026-08-25` (`62f62bf8a3b626d2ac65064a7c98b92ee28c1ab6`).
- Extract styles locally from the supplied `sugar .fig` without uploading the source file.
- Create an editable Pen reference with foundations, collapsed scanner and expanded comparison states.
- Apply the source visual system to the real investor demo without changing recognition, nutrition or retailer trust logic.

## Source-derived decisions

- iOS system background `#F2F2F7` and white surfaces.
- Sugar.no coral `#F14E58`; accessible action coral `#B4232D` for white-text buttons.
- SF Pro / SF Pro Rounded-compatible web stacks.
- `Great fit #34C759`, `Moderate fit #FFCC00`, `Low fit #F14E58`.
- 18–24 px cards and 40 px mobile sheet corners.
- No editorial serif, brown/cream palette or white marker ring.

## Technical checks

Code commit under test: `9b0d1a22a903af4c8dc243e31c9e6578c8afaf61`.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass — 22 files, 121 tests |
| `npm run build` | Pass — Next.js 16.3.1 production build and standalone assets |
| `CI=1 npm run test:e2e` | Pass — 24/24 Mobile Safari scenarios |
| Responsive matrix | Pass — iPhone 17 Pro portrait/landscape, large and small iPhone |
| Accessibility | Pass — entry and populated exact-Barbora result have no automated WCAG A/AA violations |
| Dark mode / enlarged text / reduced motion | Pass |
| Railway build | Pass — production online |
| Production health | Pass — `/api/health` returned `status: ok` and exact commit `9b0d1a22a903af4c8dc243e31c9e6578c8afaf61` |

## Defect found during verification

The first e2e run found that white 13 px text on the source coral CTA had a 3.51:1 contrast ratio. Brand coral remains unchanged for identity and fit state; interactive white-text CTAs now use `#B4232D`. The targeted accessibility scenario and the complete 24-test Mobile Safari suite passed after the fix.

## Production check

- URL: `https://sugar-no-scanner-demo-production.up.railway.app`
- Railway project: `sugar-no-scanner-demo`
- Railway environment: `production`
- Health evidence captured at `2026-08-25T11:14:48.176Z`.
- Catalog remained unchanged: 9,707 active food products, 7,433 automatic fits and 2,073 investor-pack SKUs.

## Product acceptance

1. Open the production URL on iPhone.
2. Open `Shelf demo`; confirm the camera remains dominant and four products use green/yellow/coral outlines without white rings.
3. Confirm the compact sheet uses a light-gray page, white cards, rounded headings and `View all`.
4. Expand the comparison and confirm the products are ranked best-fit-first with Protein and total Sugar.
5. Confirm the cheaper-Barbora action uses the darker coral CTA and the exact shelf/online prices remain unchanged.
6. Switch the phone to dark mode and rotate to landscape; confirm the investor demo stays in the same Sugar.no light visual system and no content overflows.
7. Open `design/sugar-no-scanner.pen` in Pen to review or continue the design without touching production code.
