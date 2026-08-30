# Captured-frame scan release evidence — 30 August 2026

## Scope

- Freeze the exact stable live-camera frame as soon as `Reading visible products…` starts.
- Keep recognition, product boxes and nutrition enrichment tied to that snapshot.
- Require an explicit retry/new-scan action before another camera scene is submitted.
- Render saved gallery photos in one predictable rounded 3:4 preview with an undistorted center crop.

## Technical checks

- `npm run verify` — passed: ESLint clean, TypeScript clean, 43 Vitest files / 218 tests passed, Next.js production build passed and standalone assets were prepared.
- `npm run test:e2e` — passed: 28/28 Mobile Safari scenarios, including visual-only snapshot hold, repeated-facing de-duplication and explicit `Scan again` scene replacement.
- `git diff --check` — passed before commit.
- Release implementation commit: `a5efb1d7b21caa72a865b5787caf184e7e60116f`.
- Railway production deployment: `18a51543-ea9b-417c-98fe-7409a97d01bd` — `SUCCESS`.
- Production checks passed on `https://sugar-no-scanner-demo-production.up.railway.app`: `/` returned HTTP 200, `/api/health` returned `status: ok` with commit `a5efb1d7b21caa72a865b5787caf184e7e60116f`, and an unauthenticated recognition request remained protected with HTTP 401.
- Production UI smoke passed: the guided shelf scene rendered 4 ranked products, all 4 had Sugar.no fit, and the cheaper-online CTA appeared only for the product with a lower verified Barbora price.

## Product checks

1. Aim the live camera at a shelf and wait for `Reading visible products…`.
2. Move the phone away or close the shelf/fridge. The analyzed shelf image must remain visible and result boxes must stay attached to that frozen image.
3. Wait at least two seconds. No new recognition request or replacement scene should appear.
4. Start a new scan explicitly. Only then should the current live camera view replace the held result.
5. Upload one landscape and one portrait image. Both should use the same rounded 3:4 preview without stretching.
