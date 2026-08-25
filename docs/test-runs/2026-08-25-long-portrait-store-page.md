# Long portrait online-store recognition — 25 August 2026

## Scope

This run verifies the saved-image path for a long portrait retailer screenshot. The implementation reads the complete image plus three overlapping vertical sections, gives Gemini explicit online-grocery-page context, de-duplicates repeated SKU reads and opens a multi-product upload as one vertical Sugar.no ranking. Saved images no longer display the live-camera corner guide because it is not a crop.

## Code under test

- Behavior commit: `dc2fe6ef7918d42685ec08bef504fdf0a9ace9b4`
- GitHub branch deployed: `main`
- Railway deployment: `3f5df31f-0ac8-4103-b853-6c359af2df7a`
- Production URL: `https://sugar-no-scanner-demo-production.up.railway.app/`

## Technical checks

| Check | Result |
| --- | --- |
| `npm test -- --run src/lib/upload-scan.test.ts src/server/recognition.test.ts` | Pass: 2 files, 23 tests |
| `npm run verify` | Pass: lint, typecheck, 20 Vitest files / 111 tests, production build and standalone asset preparation |
| Targeted Mobile Safari upload scenarios | Pass: landscape four-pass and long portrait four-pass / merged-list journeys |
| `CI=1 npm run test:e2e` | Pass: 22/22 Mobile Safari scenarios |
| `git diff --check` | Pass |
| Railway build/deploy | `SUCCESS` |
| Production `/api/health` | `status=ok`, commit `dc2fe6ef7918d42685ec08bef504fdf0a9ace9b4`, 9,707 active foods and 7,433 products with automatic fit |

The long-portrait regression asserts four recognition requests, one merged row per unique SKU, an automatically expanded accessible result dialog and zero saved-image crop guides. The prompt regression asserts that online-store product cards are candidates and that an online-page price cannot become a photographed shelf price.

## Production check with the supplied Rimi screenshot

The project owner's `Sugar.no Live Scanner.png` was selected through the production `Use saved photo` control. The browser sent four requests to the existing recognition API; all four returned HTTP 200. No raw frame, request body or screenshot copy was written to the repository or analytics.

The merged production result contained three unique, fully rated rows:

1. `BALTAIS — Biezpiena krēms Protein BALTAIS persiku 300g` — Great fit; Protein 10 g, Sugar 2.9 g.
2. `BALTAIS — Biezpiena krēms Protein BALTAIS Stracciatella 200g` — Great fit; Protein 12.2 g, Sugar 2.9 g.
3. `JUNGLE POP — Želeja JUNGLE POP kivi 115g` — Low fit; Protein 1.6 g, Sugar 13.8 g.

The UI reported `3 products · 3 with Sugar.no fit`, opened the vertical `Best fit first` list automatically and rendered no `scan-guide` element over the saved screenshot.

## Product-owner check

1. Open the production URL on iPhone Safari and choose `Show demo` → `Use saved photo`.
2. Select the same long Rimi screenshot.
3. Confirm there are no white corner guides over the saved page.
4. Confirm the result opens as one list and contains one row each for Baltais peach, Baltais Stracciatella and Jungle Pop.
5. Confirm the two Baltais variants stay distinct, repeated reads do not create duplicate rows and an online-page price is not labelled as a shelf-camera price.

## Evidence boundary

This is one successful real screenshot check, not a recall benchmark for every retailer page or long screenshot. Very small text, a page with more than the per-section response limit, occlusion or retailer layouts without readable adjacent titles can still reduce recall. Exact nutrition and fit remain source-backed and fail closed.
