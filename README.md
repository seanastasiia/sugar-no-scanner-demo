# Sugar.no Live Scanner

Private Latvia proof of concept for camera-based identification and comparison of packaged groceries. It is a wellness discovery tool, not a medical device or an absolute rating of food.

- Live demo: [sugar-no-scanner-demo-production.up.railway.app](https://sugar-no-scanner-demo-production.up.railway.app)
- Public source: [github.com/seanastasiia/sugar-no-scanner-demo](https://github.com/seanastasiia/sugar-no-scanner-demo)
- Access: request the private investor code from the repository owner.

## Current state

The app is a working mobile-first web/PWA concept with:

- a private access-code gate;
- automatic live-camera frame sampling after the user grants permission;
- one recognition API for camera, saved images, a deterministic four-item shelf photo and a four-item checkout photo;
- a reproducible index of 19,076 Barbora Latvia product pages for package naming and retailer lookup;
- a curated nutrition catalog of 40 protein snacks used only for the verified Sugar.no badge;
- 10 golden products with independently sourced fiber and a deterministic three-signal Sugar.no badge;
- 30 catalog products that intentionally show `Data pending` until fiber is verified;
- photorealistic concept scenes with compact green-check, yellow-minus and coral-alert markers placed over the detected packages;
- a Checkit-inspired camera-first layout with an enlarged, stable half-screen camera area, selected-product focus and compact bottom sheet with a horizontally scrollable tray and similar options;
- normalized detection boxes, a de-duplicated checkout tray, similar options and exact Barbora product links;
- camera-read shelf prices plus a live Barbora offer lookup with source time and fail-closed exact-SKU state;
- same-SKU grouping so repeated facings such as four Coca-Cola cans count as one unique product;
- a held live-camera result with an explicit `Scan again` action, so moving the phone cannot replace the result while it is being read;
- an in-scanner Shelf/Checkout switch plus device-local `Saved options` that survive reloads without an account;
- metadata-only analytics with raw-image-like values rejected at the API boundary;
- iPhone-sized WebKit end-to-end coverage and committed visual evidence.

The guaranteed shelf and checkout scenes work without third-party credentials. Live camera/upload recognition names readable packages even outside the scored snack catalog, then searches the Barbora index and checks the matched public product page on demand. The app is deployed from GitHub `main` to Railway with an HTTPS domain and private access-code gate. Production catalog/analytics storage still requires Supabase.

## Product rules

Recognition and nutrition are separate trust levels. Gemini may read any visible package identity and a clearly associated physical shelf-price label. It never supplies nutrition, a Sugar.no score or a retailer price. The server maps the observed identity to the 19,076-entry Barbora page index, verifies the best candidate against the live public page and assigns curated nutrition only when the exact SKU belongs to the 40-product verified catalog.

An unknown product can therefore show `Product recognized` without receiving a Sugar.no badge. The `Top fit / Mixed / Trade-offs` legend appears only when at least one visible product has complete verified nutrition; otherwise the interface says `Identified, not rated`. The price card appears only when Gemini reports a separate physical price label, confidence is at least 0.90 and the exact OCR text includes a matching EUR amount. A package number, deposit or online offer cannot create the card. A possible retailer candidate is never linked or displayed as a comparison. The shelf price is crossed out only when the camera price is unambiguous, the Barbora SKU match is exact and the currently fetched online price is lower. Because only one retailer is connected, the interface says `Barbora online`, never `best price`.

Repeated facings are grouped by verified catalog ID, exact retailer SKU or normalized brand/product identity. After a successful live-camera scan, the captured frame and result are held while the user reads. `Scan again` clears the previous result and resumes analysis for the next product; detections from different moments are not accumulated into one tray.

The implementation keeps a deterministic internal comparison score for ranking:

`comparison = ⅓ protein percentile + ⅓ fiber percentile + ⅓ inverse total-sugar percentile`

The main UI does not show an unexplained number. It presents a Sugar.no badge with three separate, text-labelled signals: Protein, Fiber and Sugar. Each signal is `Higher`, `Middle` or `Lower` relative to the verified protein-snack catalog; the sugar direction is inverted so lower total sugar receives the stronger signal. Shelf markers summarize the combined result as `Top fit`, `Mixed` or `Trade-offs`. Green, yellow and coral/red are supporting visual cues paired with icons and text, never the only explanation and never a verdict that food is good or bad.

Each percentile uses all available verified values in the 40-product protein-snack category. A product receives no overall badge state unless its protein, fiber and total sugar are all numeric. A verified `no added sugar` claim is shown separately and never changes the comparison. Similar products rank by format first and internal comparison second; commercial status is not part of recommendation ranking.

`Save for next shop` is a real demo action rather than explanatory copy. Saved product IDs live only in browser `localStorage`, can be removed at any time and are restored after reload. The demo has no account or cross-device synchronization; the server receives only the bounded `product_saved` or `product_unsaved` analytics event, never the local list itself.

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

Open `http://localhost:3000`. Development allows local access when `DEMO_ACCESS_CODE` is blank. Camera access on a real iPhone requires HTTPS; use the Railway URL for physical-device QA.

## Environment

See `.env.example` for every variable.

- `DEMO_ACCESS_CODE`, `DEMO_SESSION_SECRET`: private investor access. Both are required in production.
- `GEMINI_API_KEY`, `GEMINI_MODEL`: server-side live recognition. The default is the stable `gemini-3.7-flash` model.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: server-only catalog and event storage.
- `RECOGNITION_CONFIDENCE_THRESHOLD`: minimum package-identity confidence before a product is shown; the prototype default is `0.72`.
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
npm run supabase:seed
```

For production-like browser tests, build first and then run:

```bash
npm run build
E2E_PRODUCTION=1 CI=1 npm run test:e2e
```

## API

- `POST /api/auth`: validates the demo code and sets a 12-hour HttpOnly cookie.
- `POST /api/recognize`: accepts a bounded image data URL or deterministic sample source; returns package identity, normalized boxes, optional camera-read shelf price, exact/possible retailer offer state and `imageStored: false`.
- `GET /api/products/:id`: returns sourced nutrition, Match and independent alternatives.
- `POST /api/events`: stores bounded metadata only and rejects raw-image-like fields.
- `GET /api/health`: Railway health check with commit metadata.

## Catalog

`npm run catalog:sync` refreshes exactly 40 scored products from public Barbora Latvia pages and applies the reviewed field-level overrides in `data/fiber-overrides.json`. `npm run catalog:sync:barbora-index` refreshes the product slugs published in Barbora's public sitemap; the current snapshot contains 19,076 pages. `npm run catalog:validate` checks both datasets, uniqueness, exact retailer links and nutrition completeness.

The broad index intentionally stores no price snapshot. After a package is read, the server fetches only the top candidate product pages, rejects candidates whose retailer brand conflicts with the observed package, parses the current public `window.product` payload and caches it for five minutes. This keeps price provenance and timestamp explicit without claiming inventory, affiliate status or cross-retailer best price.

Barbora publishes protein and total sugars for these products but not numeric fiber. Fiber therefore needs a manufacturer/label source. Pending products remain recognizable and show their known facts, but do not receive Match.

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

- Camera starts only after a user action and browser permission.
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
- [Defect log](Bugs.md)
- `docs/test-runs/` for commit-specific technical results

## Sample-scene assets

`public/samples/latvia-shelf.jpg` and `public/samples/latvia-checkout.jpg` are AI-generated concept photos created for this private prototype. They deliberately contain no Sugar.no overlays; the app renders every marker and selection state from the recognition response. These images make the interaction reproducible without third-party credentials, but they do not measure recognition accuracy.

## Known limitations

The generated deterministic shelf and checkout photos prove the multi-product interaction with overlays on the source scene; they are not evidence of computer-vision accuracy. The broad Barbora index improves coverage but does not mean every package will receive an exact SKU match: packaging, language, variants, availability and prices change. Shelf-price OCR is shown only above its confidence threshold and still needs physical Latvian store validation. Barbora is the only connected retailer, so `best price` is not claimed. Device-local saved options still cover only curated products and do not sync between phones. Real p95 latency, false positives, physical iPhone behavior and cross-retailer comparison remain unverified. See [Bugs.md](Bugs.md) for the live list.
