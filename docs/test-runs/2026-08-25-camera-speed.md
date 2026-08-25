# Live camera latency release · 2026-08-25

## Scope

Implementation commit: `efdf709599411575f3637d402d86eb468e3f0fd8`.

The live camera now starts its first stable-frame attempt about 120 ms after the video becomes playable, returns after the primary Gemini identity pass plus local index matching, and moves optional Barbora/Open Food Facts resolution to an image-free background request. Starting a new scan aborts any stale background result.

## Technical checks

| Check | Result |
| --- | --- |
| `npm run verify` | Pass: lint, TypeScript, 21 Vitest files / 115 tests, production build and standalone asset preparation |
| `CI=1 npm run test:e2e` | Pass: 24/24 Mobile Safari scenarios in 53.4 seconds |
| Progressive-result browser regression | Pass: two identities rendered while `/api/resolve-products` remained deliberately unresolved; the full-suite run reached this state in 721 ms with mocked vision |
| Fast resolver unit/API contract | Pass: fast mode made no Barbora or Open Food Facts calls; enrichment rejected image payloads and more than eight identities |
| Privacy | Pass: both recognition responses reported `imageStored: false`; the background endpoint accepts identities only |
| Production deployment | Railway deployment `035466b0-cd21-4968-bd81-bddd28c6b17e` online from GitHub `main` |
| Production health | Pass: `/api/health` returned `status=ok`, commit `efdf709599411575f3637d402d86eb468e3f0fd8`, 9,707 active food products and 7,433 products with automatic fit |

## Production latency probe

The checked-in shelf image was sent once through the production endpoint as a live camera frame. This is a smoke probe, not a p95 benchmark or physical-iPhone result.

| Stage | Result |
| --- | --- |
| Primary camera response | 7 detections; 5,105 ms server time / 5,798 ms wall time |
| Optional identity-only enrichment | 7 detections; 672 ms wall time |

The 672 ms enrichment no longer delays the first visible result. Gemini itself remains the largest and variable component. A same-image exploratory trial with medium and low media resolution ranged from 5,222 to 9,669 ms and returned 6–8 detections, so there was no consistent speed gain. The lower-detail setting was not shipped; the default image resolution remains to protect small-package OCR.

## Product checks on iPhone

1. Open the production URL and allow the camera.
2. Hold two or more readable packages still and time from the stable preview to the first named products.
3. Confirm the held result becomes readable before an optional Barbora price appears.
4. Tap `Scan again` while retailer enrichment is pending; confirm the old products never replace the new scan.
5. Repeat on one close package and one dense shelf, recording iPhone model, iOS, light, detected SKUs and seconds.

Do not claim the `<4 s p95` acceptance target from this one image. Collect at least 20 physical-device scans before making that statement.
