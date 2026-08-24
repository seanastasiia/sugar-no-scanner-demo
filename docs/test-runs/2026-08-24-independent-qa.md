# Independent QA · public camera-first scanner

Date: 2026-08-24 (Europe/Riga)

Scope: independent release audit of the public camera-first flow, deterministic shelf/checkout demos, partial Sugar.no rating states, multi-product resolution, privacy and rate limiting.

## Automated checks

| Command | Result |
| --- | --- |
| `npm test` | Pass: 15 files, 92 tests |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass; 7 routes/pages generated and standalone assets prepared |
| `node --import tsx scripts/validate-catalog.ts` | Pass: 40 scored rows, 10 complete-nutrition rows and 19,076 indexed Barbora pages |
| `CI=1 npm run test:e2e` | Not runnable in this managed sandbox: the OS rejects even an explicit loopback bind with `listen EPERM 127.0.0.1:3000` |
| `npx playwright test --list` | Pass: 21 Mobile Safari scenarios discovered |

The Playwright host command is now explicit (`next dev --hostname 127.0.0.1`) and production-mode tests set `HOSTNAME=127.0.0.1`. This removes accidental `0.0.0.0` binding, but does not bypass the managed environment's blanket socket restriction. Browser assertions are therefore written and type/lint checked here, but must be executed in CI or a normal local shell before release.

## Functional audit

- Public `/` is the camera-first route; `/access` redirects to `/`; stale access-code and `Private demo` browser expectations were removed.
- `Show demo` exposes shelf, checkout and saved-photo paths; both deterministic scenes return to live camera.
- Scoring unit coverage includes 3/3, every 2/3 permutation, every 1/3 permutation and zero-signal identity-only products.
- Fair winner logic compares only a shared category, per-100 basis, method and at least two common signals; a gap below five is treated as a tie.
- Retailer resolution attempts all eight provider identities with bounded concurrency, including identities seven and eight.
- Repeated facings are deduplicated after the same resolution path; object-cover box projection is covered for portrait crop, clipping and matching aspect ratios.
- E2E additions assert that all three 2/3 signal masks explain the actual available and missing nutrients, while 1/3 and identity-only states stay neutral and have no overall fit.
- Price comparison requires a trusted physical label and exact SKU; possible matches, missing labels and non-cheaper offers do not expose a cheaper-purchase CTA.
- Samples bypass live recognition rate limiting; raw-image-like analytics metadata is rejected.

## P0 findings raised and fixed during QA

The first reviewed implementation had three release-blocking camera-loop failures:

1. The client could attempt about 28.6 stable frames per minute while the server default allowed 12, causing an unmatched investor scan to hit `429` in about 25 seconds.
2. `429` and provider-unavailable responses did not stop the capture loop or respect `Retry-After`, so requests continued and the UI only showed a generic error.
3. A provisional single-product broad result was erased when the one-time shelf-completion pass returned `not_sure`.

The final source fixes align the default limiter with camera cadence at 36/60, stop the capture loop on `429` and provider-unavailable responses, expose retry/demo recovery, and retain the provisional product when shelf completion is uncertain. Unit coverage is green and the 21-scenario Mobile Safari suite includes all three regressions. Because this sandbox cannot bind a test server, the browser suite still requires execution in CI or a normal local/release environment.

## Latvian-store shelf inputs

The temporary benchmark inputs were visually inspected but not committed. No local Gemini credential exists in this checkout and outbound DNS is blocked, so no live recognition call was made and no CV accuracy is claimed.

| Image | Framing assessment | Identity count | Exact vs visual-only | Rated count | Duplicate / false-positive evidence | Latency |
| --- | --- | ---: | --- | ---: | --- | --- |
| `maxima-salacgriva.jpg` | Wide establishing aisle; most pack text is too small for a realistic phone shelf scan | Not run | Not run | Not run | Not run | Not run |
| `rimi-bauska-candy.jpg` | Wide candy/endcap scene; many packages, but labels are distant | Not run | Not run | Not run | Not run | Not run |
| `rimi-brivibas.jpg` | Wide aisle; some nearer packages but still primarily an establishing shot | Not run | Not run | Not run | Not run | Not run |
| `rimi-ditton.jpg` | Very wide store overview; unsuitable as a close-shelf accuracy target | Not run | Not run | Not run | Not run | Not run |
| `rimi-bauska-01-small.jpg` | Adult-drink display; useful as an unrated/adult negative scene, not a nutrition benchmark | Not run | Not run | Not run | Not run | Not run |
| `rimi-bauska-02-small.jpg` | Distant adult-drink wall; negative scene only | Not run | Not run | Not run | Not run | Not run |
| `rimi-bauska-03-small.jpg` | Wide freezer/aisle overview; products are too distant for close-shelf expectations | Not run | Not run | Not run | Not run | Not run |

Image filenames were used only to identify files. No product identity, nutrition value or correctness claim was inferred from a filename.

For a meaningful next benchmark, capture 10–20 shopper-distance frames (roughly 0.5–1.5 m) with front-facing labels large enough to read, then manually transcribe visible ground truth before running Gemini. Report identity recall, exact/visual-only split, rating coverage, duplicates, unsupported false positives and latency separately.

## Final completion record

Reviewed working tree base: `116a2a30e9bcb7878e430735d2191d61e9c3cac6` plus the uncommitted implementation diff.

Available local gates pass: unit 92/92, typecheck, lint and production build. Browser tests are discovered and compile, but the 21 Mobile Safari scenarios are not marked passed in this record because the managed sandbox rejects the required loopback listener.

Required post-deploy Browser smoke:

1. Open production `/` without cookies and confirm camera-first entry, no password and no `Private demo` label.
2. Deny camera once; verify `Enable camera` and `Show demo` remain usable.
3. Run Shelf demo, expand/collapse results, return to live, then run Checkout demo.
4. Mock or stage broad-one then completion-uncertain; verify the confirmed product remains locked.
5. Exercise provider-unavailable and `429`; verify request count stops, the retry delay is visible and demo/retry actions work.
6. At 375×812 with reduced motion, verify no horizontal overflow, background focus isolation and no automated WCAG A/AA violations.
7. Confirm raw-image analytics rejection and exact-SKU-only cheaper Barbora CTA on the deployed API/UI.
