# Live camera tracking release evidence

Date: 2026-08-29  
Implementation commit: `2525e9df4380795b662430d8758846eac9692b5e`

## Delivered behavior

- The camera preview remains live after recognition; the app no longer presents an old captured frame as if it were the current view.
- A lightweight on-device luma tracker follows small camera movement and translates confirmed product boxes without another Gemini request.
- Two consecutive scene mismatches remove stale boxes and cards, cancel the old response, and start one recognition request for the replacement scene.
- Neutral dashed candidate regions may appear while the first semantic result is pending. Fit colors still require an exact recognized product with verified protein and total sugar.
- First-frame capture has a 1.25-second ceiling, and one Gemini request is used per stable scene.

This is a browser proof of concept, not native object tracking. The local tracker follows global camera motion between semantic reads; it does not identify products independently of Gemini.

## Technical verification

The following checks ran against the exact worktree committed as `2525e9d`:

- `npm run verify`: passed — lint, TypeScript, 43 test files / 218 tests, and the production build.
- `npm run test:e2e`: passed — 28/28 Mobile Safari scenarios.
- Large-text/dark-mode regression repeated three times: 3/3 passed.
- Live tracking unit suite: 4/4 passed for translation, box movement, scene replacement, and neutral candidates.
- `git diff --check`: passed.

The E2E harness now waits for camera hydration instead of waiting for network idleness. A live scanner intentionally keeps background requests active, so network-idle was not a valid readiness condition.

## Product checks after deployment

1. Open the live camera on an iPhone and hold a mixed shelf steady. Neutral candidates may appear first; named fit boxes must appear only after recognition.
2. Move the phone slightly left or right. Confirmed boxes should stay aligned with the same products while the video continues moving.
3. Point the camera at a clearly unrelated scene or close the fridge/shelf view. Old boxes and old cards should disappear, followed by a fresh recognition attempt.
4. Keep the original scene stable after a result. The same scene must not trigger repeated paid Gemini calls.
5. Scan an unsupported item. The app must remain honest rather than assigning a fit without exact, source-backed protein and sugar.

GitHub, Railway and production smoke evidence are appended only after the release succeeds.
