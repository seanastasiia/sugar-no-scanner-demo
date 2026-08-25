# Sugar.no Live Scanner

Mobile-first Latvia proof of concept for identifying packaged groceries from a live camera or saved photo, comparing visible products with a transparent Sugar.no fit, and linking an exact product to Barbora when available.

- Production: [sugar-no-scanner-demo-production.up.railway.app](https://sugar-no-scanner-demo-production.up.railway.app)
- Repository: [github.com/seanastasiia/sugar-no-scanner-demo](https://github.com/seanastasiia/sugar-no-scanner-demo)
- Status: public investor demo, not a medical device or production-wide grocery catalog.

## Current product behavior

- Camera starts after permission without requiring a shutter action.
- Live camera, saved shelf photo and checkout photo use the same recognition contract.
- A scan keeps at most five distinct, highest-confidence readable products. Repeated facings of one SKU are grouped.
- Rated products are ordered best fit first and use `Great fit`, `Moderate fit`, or `Low fit`.
- Expanded multi-product results use the ranked list as the single comparison view; they do not repeat the leading product in a second `Best fit in this scan` card.
- The expanded comparison uses one downward-chevron control to return to the camera view.
- Sugar.no fit uses verified protein and total sugar per 100 g or 100 ml. Fiber is not required or displayed.
- Nutrition resolution order is: curated catalog, exact Barbora snapshot, strict Open Food Facts match, then exact Google Search-grounded web nutrition.
- Internet enrichment runs after the first identity result. It is bounded to 18 seconds and never receives or stores the camera image.
- A fit is shown only for an exact source-backed product. Otherwise the row says `Nutrition not verified online`.
- Physical shelf price appears only from a clearly associated high-confidence EUR label.
- A crossed-out shelf price and `Buy cheaper at Barbora` appear only when the exact Barbora SKU is currently cheaper.
- Deterministic Shelf and Checkout demo scenes work without Gemini credentials.

## Trust rules

- Recognition confidence and nutrition confidence are separate.
- The app never estimates missing nutrition, converts a serving into per-100 values, or borrows data from another flavor or pack size.
- A possible retailer match cannot drive a price, purchase link, or fit.
- Raw images are analyzed in memory and are not written to analytics or Supabase.
- Commercial availability never changes Sugar.no ranking.

## Stack

- Next.js 16, React 19, TypeScript
- Gemini for visual identity and optional Google Search-grounded exact nutrition
- Versioned Barbora and curated JSON snapshots in `data/`
- Supabase schema for managed catalog and metadata-only analytics
- Vitest and Playwright WebKit
- Railway production deployment from GitHub `main`

## Local setup

Requirements: Node.js 22+, npm, and HTTPS or localhost for camera access.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Production-style local run:

```bash
npm run build
npm run start
```

## Environment

See `.env.example` for the complete list.

Core runtime values:

- `GEMINI_API_KEY`: enables live visual recognition and grounded nutrition fallback.
- `GEMINI_MODEL`: optional visual-model override.
- `GEMINI_WEB_NUTRITION_MODEL`: optional grounded-search model override.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: optional catalog/analytics client configuration.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only seed and managed data operations.
- `COMMIT_SHA`: fallback health metadata for direct Railway uploads.

Never commit real secrets. Railway stores production values.

## Commands

```bash
npm run dev                 # local development
npm run check:fast          # lint + typecheck + unit/integration tests
npm run test:e2e:smoke      # four critical Mobile Safari flows
npm run verify              # lint + typecheck + all unit/integration tests + build
CI=1 npm run test:e2e       # complete Mobile Safari acceptance suite
npm run catalog:validate    # curated catalog validation
npm run benchmark:recognition -- /absolute/path/photo.jpg
```

Use the project change lanes in `AGENTS.md`:

- docs/copy: diff and link check only;
- small UI: scoped checks plus smoke browser suite;
- local logic: related tests plus `check:fast`;
- recognition/scoring/privacy/auth/schema/dependency/release: `verify`, full browser suite, Railway deploy and production smoke.

## API

- `POST /api/recognize`: image data URL plus source type, returns bounded detections.
- `POST /api/resolve-products`: up to five image-free identities, returns optional exact retailer/nutrition enrichment.
- `POST /api/events`: metadata-only product events with image-like values rejected.
- `GET /api/health`: service, catalog and deployed commit status.

## Data and Supabase

Checked-in generated snapshots make the investor demo reproducible and fast:

- `data/catalog.generated.json`: curated comparison catalog.
- `data/barbora-product-index.generated.json`: retailer identity index.
- `data/barbora-food-product-index.generated.json`: active food subset.
- `data/barbora-nutrition-index.generated.json`: source-backed nutrition snapshot.

Regeneration and validation scripts live in `scripts/`. Supabase migrations and seed tooling live in `supabase/`. Do not hand-edit generated JSON.

## Railway release

Normal releases are pushed once, after the requested batch is complete:

```bash
git push origin HEAD:main
npx @railway/cli variable set COMMIT_SHA=$(git rev-parse HEAD) --skip-deploys \
  --project 9e2a4887-0e19-4ca7-ae99-d68816542558 \
  --service sugar-no-scanner-demo --environment production
npx @railway/cli up --detach \
  --project 9e2a4887-0e19-4ca7-ae99-d68816542558 \
  --service sugar-no-scanner-demo --environment production
```

Then verify `/api/health`, the public root, one critical recognition path and the no-image-storage contract. Docs-only changes do not require a Railway release unless explicitly requested.

## Product check

1. Open production in iPhone Safari and allow camera access.
2. Scan a shelf with more than five visible products and confirm no more than five distinct results appear.
3. Confirm verified results gain fit labels and unresolved products remain neutral.
4. Open Shelf and Checkout demos and expand `View all`.
5. Confirm the ranked list is followed directly by relevant price actions or similar options, without a repeated best-fit detail card.
6. Confirm a physical price appears only when a price label is visible and an exact cheaper Barbora result is clearly qualified.
7. Move the camera after a result and confirm it remains held until `Scan again`.

## Known limits

- Latvia-wide coverage is not guaranteed. Private labels, unreadable variants and products without an exact public per-100 table can remain unresolved.
- Real shelf, glare, low-light, moving-belt and price-label accuracy still require a physical store benchmark.
- Barbora is the only connected retailer, so the demo cannot claim a market-wide best price.
- Grounded web nutrition has variable latency and cost. Production should persist human-reviewed successful results in Supabase.

## Supporting docs

- [Acceptance criteria](docs/acceptance.md)
- [Product QA](docs/product-qa.md)
- [Team handoff](docs/team-handoff.md)
- [Latvia coverage plan](docs/latvia-coverage-plan.md)
- [Week-one lessons](docs/week-one-lessons.md)
- [Latest feature evidence](docs/test-runs/2026-08-25-five-product-web-enrichment.md)
- [Open and recent bugs](Bugs.md)
