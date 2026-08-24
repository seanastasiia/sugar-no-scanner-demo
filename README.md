# Sugar.no Live Scanner

Public Latvia proof of concept for camera-based identification and comparison of packaged groceries. It is a wellness discovery tool, not a medical device or an absolute rating of food.

- Live demo: [sugar-no-scanner-demo-production.up.railway.app](https://sugar-no-scanner-demo-production.up.railway.app)
- Public source: [github.com/seanastasiia/sugar-no-scanner-demo](https://github.com/seanastasiia/sugar-no-scanner-demo)
- Entry: opens directly into the camera-first scanner; no access code is required.

## Current state

The app is a working mobile-first web/PWA concept with:

- a public camera-first entry with no password gate or `Private demo` badge;
- automatic live-camera frame sampling after the user grants permission;
- full-frame shelf recognition that asks for up to eight distinct readable SKUs in one pass, while repeated facings of one SKU remain grouped;
- one recognition API for camera, saved images, a deterministic four-item shelf photo and a four-item checkout photo;
- a reproducible index of 19,076 Barbora Latvia product pages for package naming and retailer lookup;
- a curated nutrition catalog of 40 protein snacks with a deterministic two-factor category badge based on protein and total sugar;
- on-demand Sugar.no quick views for exact Barbora food pages that list energy, protein and total sugar, without preloading all 19,076 pages;
- on-demand two-factor Sugar.no fits for exact Barbora foods when energy, protein and total sugar are available;
- photorealistic concept scenes with compact green-check, yellow-minus and coral-alert markers placed only over products with a numeric Sugar.no result;
- a camera-first full-viewport scanner with Sugar.no overlays and a compact bottom results sheet that shows product thumbnails, then expands into a dedicated comparison page;
- normalized detection boxes, a de-duplicated checkout tray, similar options and exact Barbora product links;
- product cards in the expanded tray name the exact recognized SKU or variant, so several products from one brand remain distinguishable;
- camera-read shelf prices shown directly under recognized products, plus a live Barbora offer lookup with source time and fail-closed exact-SKU state;
- same-SKU grouping so repeated facings such as four Coca-Cola cans count as one unique product;
- a held live-camera result with an explicit `Scan again` action, so moving the phone cannot replace the result while it is being read;
- an automatic focused center retry after an uncertain broad camera pass, with remapped overlays and a separate conservative confidence threshold;
- an in-scanner Shelf/Checkout switch that changes scenes without restarting the scanner;
- metadata-only analytics with raw-image-like values rejected at the API boundary;
- 18 authored iPhone-sized WebKit scenarios plus deterministic sample scenes; the current managed QA sandbox cannot bind a local test server, so the browser suite remains a release-host/CI gate.

The guaranteed shelf and checkout scenes work without third-party credentials. Live camera/upload recognition names readable packages even outside the scored snack catalog, then searches the Barbora index and checks the matched public product page on demand. The app is deployed from GitHub `main` to Railway with a public HTTPS camera route. Production catalog/analytics storage still requires Supabase.

## Product rules

Recognition and nutrition are separate trust levels. Gemini may read any visible package identity and a clearly associated physical shelf-price label. It never supplies nutrition, a Sugar.no score or a retailer price. The server maps the observed identity to the 19,076-entry Barbora page index and verifies the best candidate against the live public page. A curated SKU receives the two-factor category badge. Any other exact food SKU may receive an on-demand fit only from energy, protein and total sugar actually listed on that exact Barbora page.

An unknown or data-poor product can therefore show `Product recognized` without receiving a Sugar.no result. A complete two-factor result uses the `Great fit / Moderate fit / Low fit` presentation. A product with only protein or only total sugar remains neutral and never shows a misleading approval icon or overall fit. Fiber may remain in raw source records, but it is not displayed and never affects the rating. The rating legend appears only when at least one visible product has a numeric result. The price appears directly under a recognized product only when Gemini reports a separate physical price label, confidence is at least 0.90 and the exact OCR text includes a matching EUR amount. A package number, deposit or online offer cannot create it. A possible retailer candidate is never linked or displayed as a comparison. The shelf price is crossed out only when the camera price is unambiguous, the Barbora SKU match is exact and the currently fetched online price is lower. The deal card then says `Cheaper at Barbora` and offers `Buy cheaper at Barbora`; because only one retailer is connected, it never claims `best price`.

The scanner remains the primary surface after recognition. A 166 px bottom sheet names the rated picks and exposes a horizontal thumbnail preview without covering most of the shelf. `View products`, the title or the list icon expands that sheet into a full-height, internally scrollable comparison page on phones; collapsing it returns to the held camera frame. While the full page is open, background camera controls are removed from keyboard and screen-reader focus, Escape collapses the page and reduced-motion users receive the same state change without animation.

Repeated facings are grouped by verified catalog ID, exact retailer SKU or normalized brand/product identity. After a successful live-camera scan, the captured frame and result are held while the user reads. `Scan again` clears the previous result and resumes analysis for the next product; detections from different moments are not accumulated into one tray.

Live camera recognition starts with the full scene. The broad prompt explicitly scans the shelf left-to-right and top-to-bottom, returns up to eight distinct readable front-facing SKUs and does not stop after the central package; repeated facings are grouped by identity. If that broad pass returns no supported detection, the next stable frame is automatically cropped to the central guide and analysed with a focused prompt and a lower `0.58` identity threshold. Successful boxes are mapped back to the full camera coordinates. This preserves multi-product shelf comparison first while giving one clear central package a second path without requiring a shutter button or another user action.

The implementation keeps a deterministic internal comparison score for ranking:

`comparison = ½ protein percentile + ½ inverse total-sugar percentile`

The main UI does not show an unexplained number. It presents a Sugar.no badge with two separate, text-labelled factors: Protein and Sugar. Each factor is `Higher`, `Middle` or `Lower` relative to the verified protein-snack catalog; the sugar direction is inverted so lower total sugar receives the stronger signal. Shelf markers summarize the combined result as `Great fit`, `Moderate fit` or `Low fit`, matching the main Sugar.no product. Green, yellow and coral/red are supporting visual cues paired with icons and text, never the only explanation and never a verdict that food is good or bad.

Each percentile uses all available verified values in the 40-product protein-snack category. Both source-backed factors are required for a full fit; one or zero factors never produce an overall fit. A verified `no added sugar` claim is shown separately and never changes the comparison. Similar products rank by format first and internal comparison second; commercial status is not part of recommendation ranking.

For exact Barbora food pages outside that category, the server calculates a separate reference-based fit at recognition time. Protein uses the EU `source of protein` / `high protein` energy-share thresholds; total sugar uses the EU low-sugar threshold of 5 g/100 g for solids or 2.5 g/100 ml for liquids. Sugar.no's yellow middle sugar band is explicitly defined as up to twice the official low-sugar threshold. The two bands are weighted equally for the shelf summary. `Best fit in this scan` appears only inside a fair cohort that shares category, per-100 basis, scoring method and both factors; near ties have no winner. These nutrition-claim references are not a medical or absolute health score. Adult products and pages without enough nutrition remain unrated. See [Regulation (EC) No 1924/2006](https://eur-lex.europa.eu/legal-content/en/TXT/?uri=CELEX%3A32006R1924).

The scanner deliberately has no save action. When a trusted shelf label and an exact Barbora SKU prove that the current online price is lower, the compact result replaces that secondary behavior with a one-tap `Buy cheaper` action to the exact Barbora page. Similar options remain immediately comparable, but commercial availability never changes the independent Sugar.no rating or ranking.

## Stack

- Next.js 16 App Router, React 19 and TypeScript
- browser `getUserMedia` plus a stability/motion sampler with one in-flight request
- Gemini image understanding for package identity and associated shelf-label OCR
- a compact Barbora sitemap index plus server-only on-demand product/price verification
- Supabase Postgres for catalog, sources, retailer offers and anonymous scan metadata
- Railway standalone Next.js deployment with copied public/static build assets
- Vitest and Playwright WebKit using an iPhone profile

## Local setup

Requirements: Node.js 22 or newer.

```bash
cp .env.example .env.local
npm install
npx playwright install webkit
npm run dev
```

Open `http://localhost:3000`; the scanner starts on the public camera route. Camera access on a real iPhone requires HTTPS; use the Railway URL for physical-device QA.

## Environment

See `.env.example` for every variable.

- `GEMINI_API_KEY`, `GEMINI_MODEL`: server-side live recognition. The default is the stable `gemini-3.7-flash` model.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: server-only catalog and event storage.
- `RECOGNITION_CONFIDENCE_THRESHOLD`: minimum package-identity confidence before a product is shown; the prototype default is `0.72`.
- `FOCUSED_RECOGNITION_CONFIDENCE_THRESHOLD`: minimum identity confidence for the automatic central retry; the prototype default is `0.58`.
- `RECOGNITION_RATE_LIMIT`, `RECOGNITION_RATE_WINDOW_SECONDS`: per-client live recognition allowance; defaults are `36` requests per `60` seconds. Deterministic sample scenes are exempt. A `429` response stops automatic capture and exposes the server-provided retry delay rather than retrying forever.
- `COMMIT_SHA`: optional local/fallback release identifier. Railway deployments use `RAILWAY_GIT_COMMIT_SHA` automatically.

Never expose service-role or Gemini keys through `NEXT_PUBLIC_*` variables.

The production Gemini credential is an authorization key restricted to the Gemini API and bound to a dedicated Google Cloud service account. Store it only as the Railway secret `GEMINI_API_KEY`; do not copy it into `.env.example`, GitHub, browser code or shared documentation. A successful `GET /v1beta/models` and one minimal `generateContent` request are the release checks for key validity and available quota. Gemini billing is usage/quota based rather than a prepaid token balance; enable a paid billing account only if Google returns an explicit quota or billing error.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
CI=1 npm run test:e2e
npm run build
npm run verify
npm run catalog:sync
npm run catalog:sync:barbora-index
npm run catalog:validate
npm run benchmark:focus
npm run benchmark:recognition -- --help
npm run supabase:seed
```

For production-like browser tests, build first and then run:

```bash
npm run build
E2E_PRODUCTION=1 CI=1 npm run test:e2e
```

The Playwright profile blocks service-worker registration so route-level recognition mocks behave the same in dev and production-mode runs. The deployed PWA worker remains enabled and is covered separately by the HTTPS production smoke.

## API

- `POST /api/recognize`: accepts a bounded image data URL or deterministic sample source; returns package identity, normalized boxes, optional camera-read shelf price, exact/possible retailer offer state and `imageStored: false`.
- `GET /api/products/:id`: returns curated nutrition or an on-demand exact-Barbora quick view plus independent alternatives when available.
- `POST /api/events`: stores bounded metadata only and rejects raw-image-like fields.
- `GET /api/health`: Railway health check with commit metadata.

## Catalog

`npm run catalog:sync` refreshes exactly 40 scored products from public Barbora Latvia pages. The existing `data/fiber-overrides.json` remains a raw-data compatibility source, but fiber is not used by the Sugar.no fit. `npm run catalog:sync:barbora-index` refreshes the product slugs published in Barbora's public sitemap; the current snapshot contains 19,076 pages. `npm run catalog:validate` checks both datasets, uniqueness, exact retailer links and nutrition completeness.

The broad index intentionally stores no price or nutrition snapshot. After a package is read, the server fetches only the top candidate product pages, rejects candidates whose retailer brand conflicts with the observed package, parses the current public `window.product` payload and caches it for five minutes. The same exact page may produce a two-factor fit when it lists sufficient food nutrition. This keeps provenance and timestamp explicit without claiming inventory, affiliate status or cross-retailer best price.

The 19,076-entry sitemap includes non-food, alcohol and pages without nutrition, so it is not a 19,076-product nutrition database. EU labels usually give energy, protein and total sugar, which is why the prototype now limits the fit to protein and total sugar. No missing value is generated by AI.

The measured path from broad package naming to broad verified rating coverage is documented in [docs/latvia-coverage-plan.md](docs/latvia-coverage-plan.md). It separates exact-SKU identity, sourced nutrition and category-specific comparison rather than treating one Gemini label as a complete product record.

### Real-shelf recognition benchmark

The metadata-only CLI harness submits local JPEG, PNG or WebP frames directly to the same public/local API as the camera, without using a browser file picker:

```bash
npm run benchmark:recognition -- \
  --endpoint http://127.0.0.1:3000/api/recognize \
  /absolute/path/shelf-01.jpg /absolute/path/shelf-02.jpg
```

Use a manifest when the visible SKU identities have been manually ground-truthed:

```json
{
  "cases": [
    {
      "id": "rimi-protein-shelf-01",
      "imagePath": "/absolute/path/shelf-01.jpg",
      "expectedProductIds": ["prot-bat-sal-riekst-saldin-barebells-55-g"]
    }
  ]
}
```

```bash
npm run benchmark:recognition -- \
  --endpoint http://127.0.0.1:3000/api/recognize \
  --manifest /absolute/path/benchmark.json \
  --output artifacts/benchmarks/latvia-shelf.json
```

The harness reads each image into memory, sends up to 30 transient data URLs sequentially and never copies or writes the source bytes. The optional report contains case IDs, product IDs, identity/rating coverage, duplicates, latency and the `imageStored: false` contract; it deliberately excludes local paths and raw OCR. Output uses create-only mode so an existing report cannot be silently overwritten. Images must already fit the API limits: an encoded data URL no longer than 2,800,000 characters and a JSON request no larger than 3,000,000 bytes. On macOS, prepare an oversized source as a separate temporary copy with `sips -Z 1280 input.jpg --out /tmp/sugar-no-shelf.jpg`; the benchmark never modifies the original.

The manually dispatched GitHub Actions workflow `Latvia public shelf benchmark` runs the full Mobile Safari suite, downloads five public Latvia references into the ephemeral runner and calls the deployed endpoint. It retains the metadata benchmark and any browser failure evidence for 14 days, while a final gate still fails the run if either acceptance surface fails. Its positive set contains two close Riga supermarket shelves; one wide Bauska interior and two checkout views deliberately act as distance/scene stress cases. Public-source attribution and suitability are recorded in [docs/test-runs/2026-08-24-public-latvia-image-set.md](docs/test-runs/2026-08-24-public-latvia-image-set.md). These web images are a reproducible smoke set, not a replacement for the 12 ground-truthed shopper-distance frames required for a recall claim.

## Supabase

The reproducible schema is in `supabase/migrations/202608200001_scanner_demo.sql`. It enables RLS on every table and creates no browser policies; only the server service role may read or write.

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
npm run supabase:seed
```

The app uses the checked-in local catalog and structured server logs when Supabase variables are absent. Production should configure Supabase before analytics validation.

## Railway and release

`railway.json` builds with Railpack, runs the standalone Next server from `.next/standalone/server.js` and checks `/api/health`. The `postbuild` lifecycle copies `public` and `.next/static` into the standalone artifact.

Railway must set `HOSTNAME=0.0.0.0` so its proxy and health checker can reach the standalone Next.js server.

```bash
npm run verify
CI=1 npm run test:e2e
git push origin main
npx @railway/cli login
npx @railway/cli link
release_sha="$(git rev-parse HEAD)"
npx @railway/cli variable set "COMMIT_SHA=$release_sha" --skip-deploys
npx @railway/cli up --detach --message "Deploy $release_sha from main"
npx @railway/cli status
curl -fsS https://<railway-domain>/api/health
```

GitHub `main` is the release source. `COMMIT_SHA` is refreshed before a direct CLI deployment so `/api/health` still identifies the exact release when Railway has no Git metadata for an uploaded build. A release is complete only after tests, push, a successful Railway build and a live health check. Set all production variables in Railway rather than committing `.env.local`.

## Privacy

- The public scanner requests camera permission on entry; the browser remains the authority and denial exposes `Enable camera` plus `Show demo`.
- Frames are resized in-browser and at most one recognition request runs at a time.
- Sugar.no does not persist raw frames; Gemini receives a transient frame when live recognition is enabled.
- Package text and camera-read prices are returned to the current browser session but are not added to analytics metadata.
- Supabase receives only a random session ID, coarse device class, source, product ID, confidence/latency and explicit user actions.
- Event metadata rejects image/frame/base64 keys, image data URLs and oversized values.

## Evidence and handoff

- [Product QA](docs/product-qa.md)
- [Acceptance matrix](docs/acceptance.md)
- [Investor demo script](docs/investor-demo-script.md)
- [Scanner design reference · Latvia App Store](docs/design-reference.md)
- [Monetization notes](docs/monetization-research.md)
- [Mobile screenshots](docs/screenshots)
- [Camera-first collapsed sheet](docs/screenshots/shelf-mobile.png) and [expanded result page](docs/screenshots/shelf-results-mobile.png)
- [On-demand exact-Barbora quick view](docs/screenshots/barbora-quick-view-mobile.png)
- [Recognized product price comparison](docs/screenshots/price-comparison-mobile.png)
- [Defect log](Bugs.md)
- `docs/test-runs/` for commit-specific technical results

## Sample-scene assets

`public/samples/latvia-shelf.jpg` and `public/samples/latvia-checkout.jpg` are AI-generated or AI-composited concept photos created for this prototype. The checkout fixture uses [Enkhjin photography's supermarket-belt photo on Unsplash](https://unsplash.com/photos/groceries-are-on-a-conveyor-belt-at-a-checkout-jng9usOa_J0) as its licensed environment reference, then places the four demo snack packs on the belt beside the cashier. Neither sample contains baked-in Sugar.no overlays; the app renders every marker and selection state from the recognition response. These images make the interaction reproducible without third-party credentials, but they do not measure recognition accuracy.

## Known limitations

The generated deterministic shelf and checkout photos prove the multi-product interaction with overlays on the source scene; they are not evidence of computer-vision accuracy. The broad Barbora index improves identity and on-demand data coverage but does not mean every package will receive an exact SKU match or a rating: packaging, language, variants, availability, nutrition and prices change, and the index includes non-food. Page-listed nutrition is retailer data, not an independently audited label database. Shelf-price OCR is shown only above its confidence threshold and still needs physical Latvian store validation. Barbora is the only connected retailer, so `best price` is not claimed. Real p95 latency, false positives, physical iPhone behavior and cross-retailer comparison remain unverified. See [Bugs.md](Bugs.md) for the live list.
