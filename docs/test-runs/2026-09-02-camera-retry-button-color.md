# Camera retry button color release evidence — 2026-09-02

## Scope

- Make the full-width `Not sure — try again` recovery action visually distinct from the dark informational status pill.
- Use a semantic darker blue action token with white text.
- Preserve the existing one-line label, retry behavior and 44 px touch target.
- Add stable hover, pressed and keyboard-focus feedback without layout movement.

## Technical verification

Feature commit: `9c40d47b4854169da6fb00d610f2ae6596821931`.

- White text on the `#0066cc` action surface has a calculated WCAG contrast ratio of 5.57:1.
- A Mobile Safari recovery test confirmed the exact blue background, white text, one-line label and full-width 44 px target.
- Local visual inspection confirmed that the retry action reads as a button over the camera surface.
- `npm run verify` passed: ESLint, TypeScript, 45 Vitest files with 234 tests, catalog validation and the production build.
- `CI=1 npm run test:e2e` passed all 31 Mobile Safari scenarios, including small and large phones, landscape, dark mode, enlarged text, reduced motion and automated WCAG A/AA checks.
- `git diff --check` passed.

## Product verification

1. Trigger `Not sure — try again` on the production camera.
2. Confirm it appears as a full-width blue button with white text rather than a dark informational status box.
3. Tap it and confirm a fresh scan starts.

## Boundaries

- This is a visual treatment only. Camera timing, recognition, scoring, catalog data, image handling and privacy behavior are unchanged.
