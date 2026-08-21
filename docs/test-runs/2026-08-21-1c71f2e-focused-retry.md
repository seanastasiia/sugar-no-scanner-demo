# Release verification: automatic focused camera retry

- Application commit: `1c71f2eaa813fb64de8168462bae588d38d13065`
- Branch: `main`
- Railway deployment: `d6fac300-f2c9-4fe3-a2d5-75d211ca41b3`
- Railway result: `SUCCESS`
- Production URL: `https://sugar-no-scanner-demo-production.up.railway.app`
- Build log: `https://railway.com/project/9e2a4887-0e19-4ca7-ae99-d68816542558/service/6d0d8abe-cb63-4d29-96bd-c3a290be3e7c?id=d6fac300-f2c9-4fe3-a2d5-75d211ca41b3&`

## Regression diagnosis

- Production `/api/recognize` requests around the reported 11:01 Europe/Riga scan returned HTTP 200 in 2.4–5.5 seconds, so camera upload, authorization and Gemini connectivity were running.
- The broad model pass returned no visible detections for the crowded display of repeated Rocket Bean cans.
- A production replay using Rocket Bean's official `Magic Pussy` can image returned one detection at `0.95` confidence. The reported iPhone attachment was not available as a local replayable file, so the exact physical frame still needs the owner check below.

## Change verified

- An uncertain broad camera result now automatically schedules one centered crop pass without a shutter button or camera restart.
- Focused boxes are mapped back to full-frame coordinates.
- The focused prompt explicitly groups repeated facings as one SKU and uses a separate `0.58` confidence threshold; the normal broad threshold remains `0.72`.
- Empty results log only request metadata, counts, threshold and maximum confidence. No image or recognized label text is logged.

## Technical verification

`npm run verify`

- ESLint: pass
- TypeScript: pass
- Vitest: 10 files, 38 tests passed
- Next.js production build: pass
- Standalone assets preparation: pass

`CI=1 npm run test:e2e`

- Playwright Mobile Safari: 12/12 passed
- Camera regression scenario: broad `not_sure` automatically sends `focusMode=true`, four repeated Coca-Cola facings deduplicate to one product, the result locks, and `Scan again` resets the next request to broad mode.

## Real Gemini and production smoke checks

- Local server code with the Railway Gemini secret, broad official Rocket Bean packshot: `matched`, one detection, confidence `0.95`, `imageStored=false`.
- Local server code with the Railway Gemini secret, focused official Rocket Bean packshot: `matched`, one detection, confidence `0.95`, `imageStored=false`.
- Production `/api/health`: `status=ok`, exact application SHA `1c71f2eaa813fb64de8168462bae588d38d13065`.
- Authenticated production camera request with `focusMode=true`: `matched`, `ROCKET BEAN Cold Brew Magic Pussy`, confidence `0.95`, model `gemini-3.7-flash`, latency 2.4 seconds, `imageStored=false`.
- Production secrets were not printed or added to the repository.

## Product checks still requiring the owner

1. Close and reopen the demo in iPhone Safari so the new JavaScript is loaded.
2. Center one front-facing Rocket Bean can inside the guide and hold the phone still for up to eight seconds.
3. Confirm the UI can move from `Reading the package…` to `Trying a closer center read…` and then show one recognized product type for all repeated cans.
4. Tap `Scan again`, point to a different package and confirm the old result is replaced only after the new product is recognized.
5. If the same display still returns `Not sure`, record the local time and screenshot; the new privacy-safe server log will reveal whether Gemini returned zero detections or a below-threshold detection.

The exact physical store display remains unvalidated until these iPhone steps are recorded.
