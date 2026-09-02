# Initial camera positioning delay release evidence — 2026-09-02

## Scope

- Wait at least 1.5 seconds after the live video starts before the first automatic capture.
- Keep the existing continuous-focus request, sharpness gate and stable-frame sampling.
- Keep the faster `Scan again` restart path unchanged.
- Preserve one submitted frame and one recognition request per explicit scan.

## Technical verification

Feature commit: `f507a9156255059c6d6239872ec5cbc6a4fb7650`.

- `npm run verify` — passed.
  - ESLint passed.
  - TypeScript passed.
  - Vitest: 45 files, 234 tests passed.
  - Catalog validation passed: 40 curated products, 18,554 indexed Barbora records, 6,822 Rimi records, 6 Livin records and 500 Open Food Facts records.
  - Barbora automatic fit coverage remained 7,433 exact nutrition-backed products.
  - Production build passed.
- `CI=1 npm run test:e2e` — 31/31 Mobile Safari scenarios passed.
- The dedicated timing scenario measured the first recognition request no earlier than the 1.5-second camera-positioning window, with a 50 ms test tolerance.
- The captured-frame and `Scan again` scenario passed, confirming a held result still requires an explicit next scan and the restart does not inherit the initial delay.
- `git diff --check` — passed.

## Product verification

1. Open production on iPhone Safari and allow camera access.
2. Confirm live video appears before recognition starts and there is enough time to aim at the shelf.
3. Confirm the first `Reading visible products…` state does not begin until about 1.5 seconds after the video becomes live.
4. After a result appears, tap `Scan again` and confirm the next scan begins promptly without the initial positioning delay.

## Boundaries

- This changes only the timing of the first automatic camera capture. It does not change recognition prompts, scoring, nutrition, catalog data, image handling or privacy behavior.
- The existing status message remains visible during the pause so the camera does not appear frozen.
