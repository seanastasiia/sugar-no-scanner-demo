# Sugar.no Live Scanner

Public Latvia proof of concept for camera-based identification and comparison of packaged groceries. It is a wellness discovery tool, not a medical device or an absolute rating of food.

- Live demo: [sugar-no-scanner-demo-production.up.railway.app](https://sugar-no-scanner-demo-production.up.railway.app)
- Latest live-camera latency evidence: [docs/test-runs/2026-08-25-camera-speed.md](docs/test-runs/2026-08-25-camera-speed.md)
- Latest checkout active-camera race release evidence: [docs/test-runs/2026-08-25-checkout-camera-race.md](docs/test-runs/2026-08-25-checkout-camera-race.md)
- Latest long-portrait retailer-page release evidence: [docs/test-runs/2026-08-25-long-portrait-store-page.md](docs/test-runs/2026-08-25-long-portrait-store-page.md)
- Latest checkout-demo release evidence: [docs/test-runs/2026-08-25-checkout-demo-rated-products.md](docs/test-runs/2026-08-25-checkout-demo-rated-products.md)
- Latest broad Latvia coverage evidence: [docs/test-runs/2026-08-25-broad-latvia-coverage.md](docs/test-runs/2026-08-25-broad-latvia-coverage.md)
- Public source: [github.com/seanastasiia/sugar-no-scanner-demo](https://github.com/seanastasiia/sugar-no-scanner-demo)
- Entry: opens directly into the camera-first scanner; no access code is required.

## Current state

The app is a working mobile-first web/PWA concept with:

- a public camera-first entry with no password gate or `Private demo` badge;
- the official white Sugar.no symbol and wordmark sourced from the current `sugar.no` website, stored locally as a first-party SVG so scanner branding does not depend on a third-party runtime request;
- automatic live-camera frame sampling after the user grants permission;
- a progressive live-camera path: the first stable frame is attempted about 120 ms after the preview becomes playable, Gemini's package identities are shown immediately, and optional live Barbora/Open Food Facts resolution continues in the background without blocking the held result;
- full-frame shelf recognition that asks for up to eight distinct readable SKUs in one pass, while repeated facings of one SKU remain grouped;
- one recognition API for camera, saved images, a deterministic four-item shelf photo and a real checkout photo with three recognized, source-rated products;
- a reproducible active-food index generated from 9,707 non-adult products across Barbora Latvia's main grocery sections;
- a checked-in broad nutrition snapshot of 7,433 exact products with source-backed energy, protein and total sugar (76.57% of the active-food index), plus the deployed counts in `/api/health`;
- an investor test pack of 2,073 already rated Barbora SKUs: 1,818 packaged snacks and 255 dairy desserts, yogurts, sweet curd creams and glazed curd snacks; the demo chooser names these two supported aisles explicitly;
- a curated nutrition catalog of 40 protein snacks used only as the deterministic category-percentile benchmark, not as the scanner's coverage ceiling;
- on-demand Sugar.no quick views for exact products in the broad snapshot, with one live Barbora page read for current price and availability;
- a constrained second visual confirmation pass for ambiguous same-brand candidates: Gemini may choose only among up to three pre-ranked exact Barbora SKU IDs, with candidate packshots and a 0.92 acceptance threshold; it cannot create a product or nutrition record;
- on-demand two-factor Sugar.no fits for exact Barbora foods when energy, protein and total sugar are available;
- exact GTIN/EAN nutrition fallback through Open Food Facts, with strict variant and pack-size guards;
- a dedicated `Scan nutrition label` recovery step that reads one clear per-100 table when no exact product record can supply a fit;
- photorealistic concept scenes with compact green-check, yellow-minus and coral-alert markers placed only over products with a numeric Sugar.no result; camera markers use one fit label and the fit-colored package outline, without a redundant `2/2 signals` pill or a white selected/best ring;
- a camera-first full-viewport scanner with Sugar.no overlays and a compact bottom results sheet that shows product thumbnails, then expands into a dedicated comparison page;
- normalized detection boxes, de-duplicated scan results, similar options and exact Barbora product links;
- a vertical expanded ranking that puts the highest verified Sugar.no fit first, keeps `Great / Moderate / Low fit` attached to every rated row and places unrated identities last as `Needs nutrition label`;
- ranked product rows name the exact recognized SKU or variant, so several products from one brand remain distinguishable;
- camera-read shelf prices shown directly under recognized products, plus a live Barbora offer lookup with source time and fail-closed exact-SKU state;
- a deterministic Shelf demo price comparison on the leading Barebells result: an explicitly labelled €3.49 demo shelf value is crossed out beside the exact Barbora offer verified at €2.79 on 25 August 2026, with the existing one-tap retailer action;
- same-SKU grouping so repeated facings such as four Coca-Cola cans count as one unique product;
- a held live-camera result with an explicit `Scan again` action, so moving the phone cannot replace the result while it is being read;
- an automatic focused center retry after an uncertain broad camera pass, with remapped overlays and a separate conservative confidence threshold;
- an in-scanner Shelf/Checkout switch that changes scenes without restarting the scanner;
- metadata-only analytics with raw-image-like values rejected at the API boundary;
- 24 authored Mobile Safari scenarios plus deterministic sample scenes, including progressive camera enrichment, the complete unknown-package-to-label-to-fit recovery path, landscape and long-portrait saved-image multi-pass recognition, active-camera-to-demo cancellation and a responsive matrix for iPhone 17 Pro portrait/landscape, a large iPhone and a small iPhone.

The guaranteed shelf and checkout scenes work without third-party credentials. The checkout fixture carries official manufacturer nutrition for Sproud and Schnitzer plus an explicitly labelled generic raw-chanterelle composition reference for the Stockmann pack, so all three pinned identities produce visible Sugar.no fit markers. Live camera/upload recognition names readable packages, then checks the curated benchmark, the broad exact-Barbora nutrition snapshot and an exact Open Food Facts record. If none supplies both required factors, the result says `Needs nutrition label` and offers one functional camera action instead of ending at `Identified`. The app is deployed from GitHub `main` to Railway with a public HTTPS camera route. The broad prototype catalog is a versioned server-side JSON snapshot so recognition is fast and reproducible without a runtime database dependency; Supabase remains the production schema for managed catalog workflows and analytics.

A dense landscape shelf photo is analyzed as one complete frame plus three overlapping row close-ups. A long portrait screenshot is likewise analyzed once in full plus three overlapping vertical sections; ordinary portrait and focused package photos still use one request. Saved-image recognition is explicitly told that the image may be a supermarket shelf, checkout scene or online-grocery page, so each readable retailer card can become a distinct SKU while an online-page price can never masquerade as a physical shelf label. The client remaps all section boxes to the original image, merges repeated identities and prefers a source-backed exact SKU over an overlapping generic visual read. When a saved image returns several products, the merged result opens directly as one vertical best-fit-first list. The decorative camera crop corners are hidden for saved images because they do not define the analysis region. Exact fit data remains fail-closed: section zoom improves readable flavor/pack evidence, while Barbora nutrition is attached only after deterministic text/quantity matching or a high-confidence comparison with the constrained candidate packshot.

## Product rules

Recognition and nutrition are separate trust levels. During the main scan Gemini may read a visible package identity, a coarse `snack / dairy dessert / other` category, a clearly printed EAN/UPC and a clearly associated physical shelf-price label. Nutrition is then hydrated only from the curated benchmark, an exact product in the broad Barbora nutrition snapshot or an exact Open Food Facts barcode/product record. The local matcher uses the supported category pack first, then requires compatible brand or visible sub-brand, rare variant words and pack or multipack size plus a clear runner-up margin. English/Latvian snack and dairy terms and common flavors are normalized; a front sub-brand such as `ProteinFit` may match an exact `BALTAIS` page only when the title, variant and pack evidence support it. When two or three exact snapshot candidates remain tied, one additional visual pass receives only those candidate IDs, titles and first-party packshots; the server accepts its choice only at confidence 0.92 or higher and rejects any slug outside the constrained set. An exact local snapshot match can produce a fit even if Barbora's live product page is temporarily unavailable; only the current online price and retailer CTA are then omitted. If ambiguity remains, no retailer link or fit is assigned. If all sources fail, the user can deliberately scan the package's nutrition table: the model transcribes only one visible per-100 table, and the server rejects serving-only, low-confidence, implausible or OCR-inconsistent values. AI never fills missing nutrition, calculates a retailer price or invents a Sugar.no fit.

Live camera uses progressive resolution so network lookups do not extend the time to the first useful result. The initial response contains Gemini's identity plus any exact match already available in the checked-in curated or Barbora nutrition indexes. The frame then pauses and the product sheet becomes readable. A separate bounded, image-free request may add a current exact retailer offer or strict Open Food Facts result in the background. If that optional request fails or is superseded by `Scan again`, the initial result remains unchanged. Saved-photo analysis keeps the complete resolution path because it already runs multiple deliberate image passes and does not need live-camera immediacy. A production benchmark found no consistent latency gain from lowering Gemini media resolution, so live frames retain the default detail-first setting until a larger accuracy/latency benchmark justifies that trade-off.

An unknown or data-poor product therefore remains named in the result, but its primary state is `Needs nutrition label`, with a 48 px `Scan nutrition label` action. A successful follow-up replaces only that pending identity with a complete source-labelled result while keeping the other products from the held shelf in the comparison; failure keeps the neutral state and asks for a clearer view rather than guessing. A complete two-factor result uses the `Great fit / Moderate fit / Low fit` presentation. A product with only protein or only total sugar remains neutral and never shows a misleading approval icon or overall fit. Fiber may remain in raw source records, but it is not displayed and never affects the rating. The expanded result summary does not repeat a fit legend or marker explanation; the fit stays attached to each product marker, ranked row and badge. The price appears directly under a recognized product only when Gemini reports a separate physical price label, confidence is at least 0.90 and the exact OCR text includes a matching EUR amount. A package number, deposit or online offer cannot create it. A possible retailer candidate is never linked or displayed as a comparison. The shelf price is crossed out only when the camera price is unambiguous, the Barbora SKU match is exact and the currently fetched online price is lower. The deal card then says `Cheaper at Barbora` and offers `Buy cheaper at Barbora`; because only one retailer is connected, it never claims `best price`.

The scanner remains the primary surface after recognition. A 166 px bottom sheet exposes a best-first thumbnail preview without covering most of the shelf. `View all`, the title or the list icon expands that sheet into a full-height, internally scrollable comparison page on phones. Multiple products become a vertical `Best fit first` list: rated products are sorted from higher to lower internal fit, while products without verified nutrition stay at the end as `Needs nutrition label` and receive no rank number. Each rated row exposes the visible fit label plus Protein and Sugar values, never the internal score; each pending row exposes the label-scan recovery. The header has one right-side collapse arrow; the title remains a second, text-only return target. Collapsing returns to the held camera frame. While the full page is open, background camera controls are removed from keyboard and screen-reader focus, Escape collapses the page and reduced-motion users receive the same state change without animation.

Repeated facings are grouped by verified catalog ID, exact retailer SKU or normalized brand/product identity. After a successful live-camera scan, the captured frame and result are held while the user reads. `Scan again` clears the previous result and resumes analysis for the next product; detections from different moments are not accumulated into one result list.

Changing from the live camera to Shelf demo, Checkout demo or a saved image aborts any unfinished camera request before starting the new source. A late live response cannot consume the shared recognition slot, overwrite a deterministic demo or leave the sample scene on `Trying a closer center read…`.

Live camera recognition starts with the full scene. The broad prompt explicitly scans the shelf left-to-right and top-to-bottom, returns up to eight distinct readable front-facing SKUs and does not stop after the central package; repeated facings are grouped by identity. If that broad pass returns no supported detection, the next stable frame is automatically cropped to the central guide and analysed with a focused prompt and a lower `0.58` identity threshold. Successful boxes are mapped back to the full camera coordinates. This preserves multi-product shelf comparison first while giving one clear central package a second path without requiring a shutter button or another user action.

The implementation keeps a deterministic internal comparison score for ranking:

`comparison = ½ protein percentile + ½ inverse total-sugar percentile`

The main UI does not show an unexplained number. It presents a Sugar.no badge with two separate, text-labelled factors: Protein and Sugar. Each factor is `Higher`, `Middle` or `Lower` relative to the verified protein-snack catalog; the sugar direction is inverted so lower total sugar receives the stronger signal. Shelf markers summarize the combined result as `Great fit`, `Moderate fit` or `Low fit`, matching the main Sugar.no product. Green, yellow and coral/red are supporting visual cues paired with icons and text, never the only explanation and never a verdict that food is good or bad.

Each percentile uses all available verified values in the 40-product protein-snack category. Both source-backed factors are required for a full fit; one or zero factors never produce an overall fit. In a multi-product scan, numeric fits are sorted from higher to lower; ties keep the stable scan order and unrated products stay after every rated product. A verified `no added sugar` claim is shown separately and never changes the comparison. Similar products rank by format first and internal comparison second; commercial status is not part of recommendation ranking.

For exact external food records and a trusted package-label read outside the curated snack category, the server calculates a separate reference-based fit. Protein uses the EU `source of protein` / `high protein` energy-share thresholds; total sugar uses the EU low-sugar threshold of 5 g/100 g for solids or 2.5 g/100 ml for liquids. Sugar.no's yellow middle sugar band is explicitly defined as up to twice the official low-sugar threshold. The two bands are weighted equally for the shelf summary. `Best fit in this scan` appears only inside a fair cohort that shares category, per-100 basis, scoring method and both factors; near ties have no winner. These nutrition-claim references are not a medical or absolute health score. Pages without enough nutrition remain unrated. See [Regulation (EC) No 1924/2006](https://eur-lex.europa.eu/legal-content/en/TXT/?uri=CELEX%3A32006R1924).

The scanner deliberately has no save action. When a trusted shelf label and an exact Barbora SKU prove that the current online price is lower, the compact result replaces that secondary behavior with a one-tap `Buy cheaper` action to the exact Barbora page. Similar options remain immediately comparable, but commercial availability never changes the independent Sugar.no rating or ranking.

The deterministic Shelf demo intentionally includes one transparent commercial example. Its €3.49 shelf value is marked as a demo fixture, while the attached €2.79 Barbora value, exact SKU URL and unit price were read from the public product page on 25 August 2026. This demonstrates the crossed-price and one-tap purchase flow without claiming that the generated shelf photo is a live store-price observation. Live camera results keep the stricter physical-label and freshness gates above.

## Stack

- Next.js 16 App Router, React 19 and TypeScript
- browser `getUserMedia` plus a stability/motion sampler with one in-flight request
- Gemini image understanding for package identity and associated shelf-label OCR, followed by image-free background retailer enrichment on live camera
- a compact Barbora sitemap index plus server-only on-demand product/price verification
- exact-barcode and strict identity fallback through the public Open Food Facts API
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

The scanner is pinned to the browser viewport with `top/right/bottom/left` constraints instead of relying on a cached `100dvh` height. Horizontal gutters include all four iOS safe-area insets. On phone widths the compact sheet keeps `View all` visible and collapses `Scan again` to one labelled 44 px icon button; intentional product rails remain horizontally swipeable without widening the document.

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
npm run catalog:sync:barbora-nutrition
npm run catalog:validate
npm run catalog:validate:barbora-coverage
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

- `POST /api/recognize`: accepts a bounded image data URL or deterministic sample source. `mode: products` returns package identity, optional barcode, normalized boxes, optional camera-read shelf price and exact retailer state. `mode: nutrition-label` requires the selected package identity and may return a source-backed inline fit only from one trusted per-100 table. Both modes return `imageStored: false`.
- `POST /api/resolve-products`: accepts at most eight already recognized product identities and no image. It completes optional exact Barbora/Open Food Facts resolution after a live-camera result is visible and returns `imageStored: false`.
- `GET /api/products/:id`: returns curated nutrition, an on-demand exact-Barbora quick view or an exact Open Food Facts barcode record plus independent alternatives when available.
- `POST /api/events`: stores bounded metadata only and rejects raw-image-like fields.
- `GET /api/health`: Railway health check with commit metadata and the deployed active-food / automatic-fit catalog counts.

## Catalog

`npm run catalog:sync` refreshes the 40-product protein-snack benchmark from public Barbora Latvia pages. The existing `data/fiber-overrides.json` remains a raw-data compatibility source, but fiber is not used by the Sugar.no fit. `npm run catalog:sync:barbora-index` refreshes the discovery slugs published in Barbora's public sitemap.

`npm run catalog:sync:barbora-nutrition` first enumerates current non-adult products from the main grocery sections, then resumes a rate-limited read of exact public product pages. It keeps only pages with energy, protein and total sugar and writes compact, timestamped `data/barbora-food-product-index.generated.json` and `data/barbora-nutrition-index.generated.json` artifacts. Temporary checkpoints are ignored by Git; an interrupted sync resumes without treating rate-limited pages as complete. `npm run catalog:validate:barbora-coverage` checks breadth, completeness, adult exclusion and duplicates. The generated snapshots are committed with the app so production startup and matching do not depend on crawling Barbora.

The current checked-in snapshot contains 9,707 active non-adult food SKUs, 7,433 of which have the three source fields required for an automatic two-factor fit: 76.57% catalog-data coverage across 817 brands and 276 retailer categories. Within the investor test scope, 1,818 packaged snacks and 255 dairy desserts have complete Protein/Sugar data, for 2,073 exact rated SKUs. `catalog:validate:barbora-coverage` fails if either supported pack drops below its release floor, and `/api/health` publishes both counts. This is source-data coverage, not measured visual-recognition accuracy. The curated 40-product set remains the protein-snack percentile cohort; broad products use the documented reference bands.

After a package is read, matching happens locally against the broad nutrition snapshot. Snacks and dairy desserts are first matched inside their smaller supported category pack, then fall back to the broad index if the coarse category was wrong. Brand or visible sub-brand, distinctive variant tokens, English/Latvian equivalents and pack size are weighted separately. Only a clear exact winner triggers one current Barbora product-page request for price/availability; ambiguous candidates fail closed and proceed to the strict Open Food Facts fallback. This keeps provenance and timestamp explicit without claiming inventory, affiliate status or cross-retailer best price.

The sitemap includes non-food, alcohol, stale pages and pages without nutrition, so its raw count is never presented as rated-food coverage. The release reports the active-food denominator and complete automatic-fit numerator separately. EU labels usually give energy, protein and total sugar, which is why the prototype limits the fit to protein and total sugar. No missing value is generated by AI.

Open Food Facts is a secondary public product source, not an accuracy promise. Barcode lookup is exact; text lookup is accepted only when brand, product/variant tokens and pack size agree. The server requires energy, protein and total sugars from the same returned record and caches the result for 30 minutes. See the official [Open Food Facts API documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) and [product-by-code endpoint](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/).

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
- Live retailer enrichment receives only the bounded recognized identity, box and trusted shelf-price metadata; it cannot accept or store another image. Starting another scan aborts stale enrichment.
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
- [iPhone 17 Pro camera](docs/screenshots/iphone-17-pro-camera.png), [full results](docs/screenshots/iphone-17-pro-results.png) and [landscape](docs/screenshots/iphone-17-pro-landscape.png)
- [On-demand exact-Barbora quick view](docs/screenshots/barbora-quick-view-mobile.png)
- [Nutrition-label recovery result](docs/screenshots/nutrition-label-fit-mobile.png)
- [Recognized product price comparison](docs/screenshots/price-comparison-mobile.png)
- [Defect log](Bugs.md)
- `docs/test-runs/` for commit-specific technical results

## Sample-scene assets

`public/samples/latvia-shelf.jpg` is an AI-generated or AI-composited concept photo created for this prototype. `public/samples/latvia-checkout.jpg` is a real checkout-belt photo supplied by the project owner; its published copy is cropped, resized and stripped of EXIF/GPS metadata. Neither sample contains baked-in Sugar.no overlays. The deterministic checkout response pins the three package identities Gemini could read in this frame—Sproud, Schnitzer Bio Burger Buns and Stockmann chanterelles—and attaches source-backed Protein/Sugar values so the concept visibly demonstrates three rated overlays and a best-first list. Sproud and Schnitzer use their official manufacturer pages; Stockmann chanterelles use the Norwegian Food Composition Table's generic raw-chanterelle entry and are labelled `Food composition reference`, not exact Stockmann nutrition. No shelf price or retailer match is invented. The samples make the interaction reproducible without third-party credentials, but they do not measure general recognition accuracy.

## Known limitations

The deterministic shelf fixture and pinned real-checkout result prove the multi-product interaction; they are not evidence of computer-vision accuracy. The checkout chanterelle result is a generic raw-food composition reference, not an exact Stockmann label audit. The broad Barbora index and Open Food Facts fallback improve coverage but do not mean every package will receive an exact record or automatic rating: packaging, language, variants, barcodes, availability, community data, nutrition and prices change. Page-listed nutrition and Open Food Facts are external data, not independently audited label databases. The nutrition-label recovery requires one legible per-100 table and is deliberately rejected when the basis or OCR evidence is ambiguous. Shelf-price OCR is shown only above its confidence threshold and still needs physical Latvian store validation. Barbora is the only connected retailer, so `best price` is not claimed. Real p95 latency, false positives, physical iPhone behavior and cross-retailer comparison remain unverified. See [Bugs.md](Bugs.md) for the live list.
