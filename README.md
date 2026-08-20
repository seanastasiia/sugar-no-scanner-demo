# Sugar.no Live Scanner

Private Latvia proof of concept for camera-based comparison of packaged protein snacks. It is a wellness discovery tool, not a medical device or an absolute rating of food.

- Live demo: [sugar-no-scanner-demo-production.up.railway.app](https://sugar-no-scanner-demo-production.up.railway.app)
- Public source: [github.com/seanastasiia/sugar-no-scanner-demo](https://github.com/seanastasiia/sugar-no-scanner-demo)
- Access: request the private investor code from the repository owner.

## Current state

The app is a working mobile-first web/PWA concept with:

- a private access-code gate;
- automatic live-camera frame sampling after the user grants permission;
- one recognition API for camera, saved images, the deterministic four-item shelf and animated checkout demo;
- a closed catalog of 40 products found in Barbora Latvia;
- 10 golden products with independently sourced fiber and a deterministic `Sugar.no Match`;
- 30 catalog products that intentionally show `Match pending` until fiber is verified;
- normalized detection boxes, a de-duplicated checkout tray, similar options and exact Barbora product links;
- metadata-only analytics with raw-image-like values rejected at the API boundary;
- iPhone-sized WebKit end-to-end coverage and committed visual evidence.

The guaranteed shelf and checkout scenes work without third-party credentials. The app is deployed from GitHub `main` to Railway with an HTTPS domain and private access-code gate. Live recognition still requires Gemini; production catalog/analytics storage still requires Supabase.

## Product rules

AI may select only one of the 40 supported product IDs. Nutrition, claims, Match and retailer URLs always come from the verified catalog, never from model output.

`Match = ⅓ protein percentile + ⅓ fiber percentile + ⅓ inverse total-sugar percentile`

Each percentile uses all available verified values in the 40-product protein-snack category. A product receives no total Match unless its protein, fiber and total sugar are all numeric. A verified `no added sugar` claim is shown separately and never changes Match. Similar products rank by format first and Match second; commercial status is not part of recommendation ranking.

## Stack

- Next.js 16 App Router, React 19 and TypeScript
- browser `getUserMedia` plus a stability/motion sampler with one in-flight request
- Gemini image understanding behind a server-only closed-catalog adapter
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
- `GEMINI_API_KEY`, `GEMINI_MODEL`: server-side live recognition.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: server-only catalog and event storage.
- `RECOGNITION_CONFIDENCE_THRESHOLD`: minimum confidence before a product is shown.
- `COMMIT_SHA`: optional local/fallback release identifier. Railway deployments use `RAILWAY_GIT_COMMIT_SHA` automatically.

Never expose service-role or Gemini keys through `NEXT_PUBLIC_*` variables.

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
- `POST /api/recognize`: accepts a bounded image data URL or deterministic sample source; returns known IDs, normalized boxes, confidence and `imageStored: false`.
- `GET /api/products/:id`: returns sourced nutrition, Match and independent alternatives.
- `POST /api/events`: stores bounded metadata only and rejects raw-image-like fields.
- `GET /api/health`: Railway health check with commit metadata.

## Catalog

`npm run catalog:sync` refreshes exactly 40 relevant products from public Barbora Latvia pages and applies the reviewed field-level overrides in `data/fiber-overrides.json`. It stores no prices. `npm run catalog:validate` checks shape, uniqueness, exact retailer links and data completeness.

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
npx @railway/cli up
npx @railway/cli status
curl -fsS https://<railway-domain>/api/health
```

GitHub `main` is the release source. A release is complete only after tests, push, a successful Railway build and a live health check. Set all production variables in Railway rather than committing `.env.local`.

## Privacy

- Camera starts only after a user action and browser permission.
- Frames are resized in-browser and at most one recognition request runs at a time.
- Sugar.no does not persist raw frames; Gemini receives a transient frame when live recognition is enabled.
- Supabase receives only a random session ID, coarse device class, source, product ID, confidence/latency and explicit user actions.
- Event metadata rejects image/frame/base64 keys, image data URLs and oversized values.

## Evidence and handoff

- [Product QA](docs/product-qa.md)
- [Acceptance matrix](docs/acceptance.md)
- [Investor demo script](docs/investor-demo-script.md)
- [Monetization notes](docs/monetization-research.md)
- [Mobile screenshots](docs/screenshots)
- [Defect log](Bugs.md)
- `docs/test-runs/` for commit-specific technical results

## Known limitations

The deployed deterministic shelf and checkout paths are verified over Railway HTTPS. The app has not yet been tested with physical products on a real Latvian shelf or conveyor. Actual Gemini accuracy, p95 latency, unsupported false-positive rate, Supabase writes, current retailer availability and physical iPhone camera behavior remain unverified until the corresponding credentials and test materials are available. See [Bugs.md](Bugs.md) for the live list.
