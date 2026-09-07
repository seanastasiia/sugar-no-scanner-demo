# Recovery retry button Figma alignment - 7 September 2026

## Scope

- Preview branch only: `codex/personal-fit-catalog-preview`.
- Production and `main` remain unchanged.
- Restyled `Not sure — try again` without changing its copy or retry behavior.
- Matched the Sugar.no Figma large tinted action: 56 px height, full pill radius, action-blue gradient, white gradient rim, rounded 17/22 px label and the shared action shadow.
- Kept `Show demo` as the black action and verified both recovery buttons have equal rendered heights.

## Design evidence

- Figma file: `mY0Ihk460tvTRGLK1RyTmy`.
- The supplied node `18734:29529` is a connector rather than a renderable screen. Its page leads to the camera/error flow.
- Design context from `Error 1` (`16052:86501`) defines the recovery action at 54 px in the older screen composition.
- The current Sugar.no design-system instance `Buttons, State=Off`, `Type=Tinted`, `Size=Large`, `Active=On` is 56 px high and uses the blue gradient, full radius, white gradient stroke, shadow and 17/22 px rounded semibold label. The web scanner already uses this current large-button geometry for `Show demo`, so the retry action now reuses it exactly.

## Technical checks

- `CI=1 E2E_PORT=3012 npx playwright test tests/e2e/scanner.spec.ts --grep "provider unavailability pauses live recognition"`: 1/1 passed. The test asserts the two buttons differ by at most 1 px, retry resolves to 56 px, the blue gradient is present, coral is absent, portrait and landscape stay inside the viewport, all visible touch targets remain at least 44 px and there is no horizontal overflow.
- `npm run check:fast`: ESLint passed, TypeScript passed, 75 Vitest files and 670 tests passed.
- `CI=1 E2E_PORT=3012 npm run test:e2e`: 58/58 Mobile Safari scenarios passed, including reduced motion, enlarged text, small phones, tablet sizes and landscape.
- `npm run build`: Next.js 16.3.1 production build passed; 14 routes generated and standalone assets prepared.
- Visual artifact: ignored local `test-results/pen-service-unavailable.png` shows the blue retry and black demo actions at equal height.

## Product check

1. Open the preview and trigger an uncertain or unavailable scan.
2. Confirm `Not sure — try again` is blue, reads as an action rather than an error, and is the same height as `Show demo`.
3. Tap `Not sure — try again` and confirm recognition starts again.
4. Open `Show demo` and confirm its existing behavior is unchanged.

Deployment ID and live revision are appended after Railway succeeds.
