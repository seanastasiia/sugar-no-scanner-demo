# Physical shelf autofocus and recognition release check

Date: 2026-08-28

Base revision: `27f59bef595528972ae9ad907a8e543278d99558`

Release implementation commit: `73b6d42d4005fc5830a8cceac87ec0bc67e75c71`

Target: Railway production, iPhone Safari-first

## Reported regression

The live camera stayed on `Reading visible products...` in a Latvian store. The preview also looked softer than the iPhone camera. A center pause overlay could appear when the video surface was tapped.

## Change

- Rear-camera capture requests 1920x1080 at up to 30 fps.
- Continuous focus is applied as a best-effort constraint when the mobile browser exposes it.
- The first request waits for autofocus and two consecutive stable frame samples instead of accepting the first ready frame.
- The video surface ignores pointer events, preventing Safari's native pause overlay from blocking the scanner.
- Live visual recognition defaults to `gemini-3.5-flash`; the dedicated `GEMINI_RECOGNITION_MODEL` override remains available and the general `GEMINI_MODEL` no longer silently changes this latency-sensitive path.

## Real-photo benchmark before release

Input: the user-reported Adazu chips shelf photo from iPhone Safari.

| Model | Thinking | Detections | Provider time |
| --- | --- | ---: | ---: |
| `gemini-3.5-flash-lite` | minimal | 0 | 1.537 s |
| `gemini-3.6-flash` | minimal | 6 | 6.378 s |
| `gemini-3.5-flash` | minimal | 5 | 4.710 s |

The selected model returned five distinct visible Adazu variants at 0.95 confidence. Nutrition enrichment remains asynchronous and does not delay the first identity result.

## Technical verification

- Scoped model unit suite: 26/26 passed.
- Scoped Mobile Safari camera tests: 2/2 passed, including media constraints, native-video interaction suppression and progressive result delivery.
- `git diff --check`: passed.
- `npm run verify`: passed — ESLint, TypeScript, 169 Vitest tests and the Next.js production build.
- `CI=1 npm run test:e2e`: passed — 25/25 Mobile Safari scenarios, including camera sizing, multi-product shelves, progressive enrichment, privacy and accessibility.
- Railway deployment and production smoke are recorded after the release reaches `main`.

## Product verification after deploy

1. Open production in iPhone Safari, allow camera access and point at a well-lit packaged-grocery shelf.
2. Hold the phone still for about two seconds; confirm the preview is sharp before `Reading visible products...` begins.
3. Confirm there is no large pause button over the camera image.
4. Confirm at least the clearly readable front-facing packages appear; repeated facings of the same SKU remain grouped.
5. Repeat once on the original Adazu shelf and compare the visible products with the returned cards.

## Known boundary

This is still cloud computer vision rather than an on-device detector. It improves the first useful result, but a broad physical-store recall benchmark is still required before claiming QR-like real-time recognition.
