# Sugar.no Live Scanner

Mobile-first Latvia proof of concept for identifying packaged groceries from a live camera or saved photo, comparing visible products with a transparent Sugar.no fit, and linking an exact product to a connected retailer when available.

- Production: [sugar-no-scanner-demo-production.up.railway.app](https://sugar-no-scanner-demo-production.up.railway.app)
- Repository: [github.com/seanastasiia/sugar-no-scanner-demo](https://github.com/seanastasiia/sugar-no-scanner-demo)
- Status: public investor demo, not a medical device or production-wide grocery catalog.

## Current product behavior

- The scanner follows the supplied Sugar.no iOS product screens: a cool light-gray app canvas, large white cards and sheets, subtle neutral separators, near-black typography/controls and system blue reserved for actions and focus. `Great fit`, `Moderate fit` and `Low fit` use filled, text-labelled semantic pills.
- The live feed and saved/demo scenes sit inside a large rounded camera viewport on a black scanner canvas. Live media uses its native aspect ratio, so the image fills the rounded card without artificial black bands above or below it.
- Camera starts after permission without requiring a shutter action.
- Live camera, saved shelf photo and checkout photo use the same recognition contract.
- Saved-photo views omit the redundant source badge and keep only the `Back to live` action in the top overlay.
- A scan keeps at most ten distinct, highest-confidence readable products. Repeated facings of one SKU are grouped.
- Rated products are ordered best fit first and use `Great fit`, `Moderate fit`, or `Low fit`.
- Expanded multi-product results use the ranked list as the single comparison view; they do not repeat the leading product in a second `Best fit in this scan` card.
- Expanded multi-product results show only the collapse control, `Best fit first` and the ranked product cards; duplicate summaries, counters and scan-again controls are omitted.
- The compact camera preview mirrors that ranking with `#1`, `#2`, `#3…` badges and shows total sugar per 100 g or 100 ml beneath each rated fit.
- Product thumbnails preserve the source photo proportions. When no exact retailer packshot exists, the fallback crop keeps a little neighboring shelf context instead of stretching a tight detection box.
- The compact sheet keeps `View all` as its only action; returning to live camera starts a new scan.
- `Great fit`, `Moderate fit` and `Low fit` camera markers use the same compact 24 px visual disc with thumbs-up, raised-hand and thumbs-down icons; the full detected-product outline remains the larger touch target.
- The expanded comparison uses one downward-chevron control to return to the camera view.
- Sugar.no fit uses verified protein and total sugar per 100 g or 100 ml. Fiber is not required or displayed.
- Nutrition resolution order is: curated catalog, exact Barbora snapshot, strict Rimi/Livin snapshot, isolated Open Food Facts bulk/API match, then exact Google Search-grounded web nutrition.
- Internet enrichment runs after the first identity result. It is bounded to 18 seconds and never receives or stores the camera image.
- The retired nutrition-label follow-up is removed from the UI and API; automatic exact-source enrichment is the only nutrition path.
- A product remains visible while exact nutrition is being checked, then stays in the result only when source-backed protein and total sugar produce a Sugar.no fit. A shelf price by itself never creates a result card.
- Physical shelf price appears only from a clearly associated high-confidence EUR label.
- Product overlays use Gemini's native `box2d [ymin, xmin, ymax, xmax]` coordinates and exclude shelf labels and neighboring packages from the product box.
- A high-confidence Latvian comma-decimal shelf label can be accepted even when the printed `€` symbol is not readable; numbers printed on a package remain excluded.
- A crossed-out shelf price and full-width green `Buy cheaper online` action appear only when the exact connected-retailer SKU is currently cheaper. The compact price row and its accessibility copy stay retailer-neutral; the exact destination remains in the purchase link and its accessible label.
- Exact online offers stay inside the matching product card: the camera-read shelf price is crossed out beside the lower online price, while a full-width action repeats the destination price for a clear one-tap purchase.
- `Better alternatives` are fail-closed: they must share the same exact product type, full retailer subcategory/form and nutrition basis, have `Great fit` that is no worse than the scanned product, and resolve to a current exact Barbora offer. Equal-fit candidates are ordered by lower live price and then the closest pack size. `Moderate fit`, `Low fit` and unrated products are excluded; if no qualifying substitute is available, the section is hidden.
- Deterministic Shelf and Checkout demo scenes work without Gemini credentials.
- The demo chooser goes directly to Shelf demo, Checkout demo and saved-photo actions without a separate investor-coverage card.

## Trust rules

- Recognition confidence and nutrition confidence are separate.
- The app never estimates missing nutrition, converts a serving into per-100 values, or borrows data from another flavor or pack size.
- A possible retailer match cannot drive a price, purchase link, or fit.
- Raw images are analyzed in memory and are not written to analytics or Supabase.
- Commercial availability never changes Sugar.no ranking.

## Stack

- Next.js 16, React 19, TypeScript
- Gemini for visual identity and optional Google Search-grounded exact nutrition
- Versioned curated, Barbora, Rimi and Livin snapshots in `data/`
- An isolated Open Food Facts ODbL layer with explicit attribution and separate Supabase storage
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
npm run catalog:sync:rimi  # low-rate Rimi page snapshot
npm run catalog:sync:livin # low-rate Livin page snapshot
npm run catalog:sync:off-latvia # refresh a bounded Latvia OFF API snapshot
npm run catalog:import:off # import official OFF JSONL/JSONL.GZ into its isolated layer
npm run supabase:seed:external # seed retailer and ODbL layers after migrations
npm run benchmark:recognition -- /absolute/path/photo.jpg
```

Use the project change lanes in `AGENTS.md`:

- docs/copy: diff and link check only;
- small UI: scoped checks plus smoke browser suite;
- local logic: related tests plus `check:fast`;
- recognition/scoring/privacy/auth/schema/dependency/release: `verify`, full browser suite, Railway deploy and production smoke.

## API

- `POST /api/recognize`: image data URL plus source type, returns bounded detections.
- `POST /api/resolve-products`: up to ten image-free identities, returns optional exact retailer/nutrition enrichment. The client resolves up to five identities concurrently and applies each response independently, so one slow lookup does not hold already verified products; successful exact web lookups remain cached for 24 hours in the running service.
- `POST /api/offers`: up to ten known exact Barbora slugs, returns current per-card offers without blocking recognition.
- `POST /api/events`: metadata-only product events with image-like values rejected.
- `GET /api/health`: service, catalog and deployed commit status.

## Data and Supabase

Checked-in generated snapshots make the investor demo reproducible and fast:

- `data/catalog.generated.json`: curated comparison catalog.
- `data/barbora-product-index.generated.json`: retailer identity index.
- `data/barbora-food-product-index.generated.json`: active food subset.
- `data/barbora-nutrition-index.generated.json`: source-backed nutrition snapshot.
- `data/rimi-catalog.generated.json`: exact Rimi product-page bootstrap snapshot.
- `data/livin-catalog.generated.json`: exact Livin product-page bootstrap snapshot.
- `data/rimi-catalog-sync-report.generated.json` and `data/livin-catalog-sync-report.generated.json`: complete configured-scope accounting.
- `data/open-food-facts-lv.generated.json`: attributed Latvia subset imported through the ODbL bulk pipeline.
- `data/catalog-sources.generated.json`: source, license and redistribution manifest.

Regeneration and validation scripts live in `scripts/`. Supabase migrations and seed tooling live in `supabase/`. Do not hand-edit generated JSON. Rimi/Livin snapshots are for the private proof of concept; production reuse and recurring ingestion require retailer permission. Open Food Facts rows stay logically and physically separate because of ODbL obligations. See [catalog sources](docs/catalog-sources.md).

Connected-retailer resolution runs before Open Food Facts and grounded web lookup. The Rimi matcher normalizes a small audited set of English package labels to their Latvian catalog identity while still requiring the same brand, pack size and an unambiguous top candidate. A translated identity that remains ambiguous is not accepted and may proceed to the bounded fallback chain.

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
2. Confirm the camera is a large rounded card whose live image reaches the rounded top and bottom edges without black bands; the logo and source/demo controls remain outside it, while recognition status stays inside it.
3. Scan a shelf with more than ten visible products and confirm no more than ten distinct results appear.
4. Confirm verified results gain fit labels and unresolved products disappear after the exact lookup finishes.
5. Open Shelf and Checkout demos and expand `View all`.
6. Confirm the expanded comparison begins with `Best fit first` and the ranked cards, without duplicate summaries, rated counters or a second scan-again button.
7. Confirm a physical price appears only when a price label is visible and an exact cheaper Barbora result is clearly qualified.
8. Confirm each overlay tightly follows its package rather than a nearby shelf label.
9. Move the camera after a result and confirm it remains held until `Scan again`.
10. Open a rated product and confirm `Better alternatives` contains only the same product type with `Great fit` no worse than the source and a live price; `Moderate fit`, `Low fit`, unrated products, and products without a valid substitute should show no alternatives block.
11. Scan the Rimi private-label examples `Pastry twists SALTY 125g`, `Pastry twists CHEESE 125g`, `multi fruit 200ml` and `strawberry banana 200ml`; confirm they resolve from the connected Rimi snapshot rather than waiting for cited web nutrition.
12. Confirm camera markers use equally sized compact icons: thumbs-up for Great fit, raised hand for Moderate fit and thumbs-down for Low fit; tapping anywhere inside the outlined package still opens the product.
13. Scan a product without an exact packshot and confirm its preview thumbnail keeps the package proportions; a little neighboring shelf context is acceptable, but the package must not look stretched.
14. Confirm a purchase button is absent when the exact online offer is not cheaper than the visible shelf price; when it is cheaper, confirm the card shows one full-width green `Buy cheaper online` action.
15. Scan exact Rimi and Livin products and confirm their retailer packshots load instead of a broken-image icon.

## Known limits

- Latvia-wide coverage is not guaranteed. Private labels, unreadable variants and products without an exact public per-100 table can remain unresolved in recognition; they are hidden from the final comparison rather than shown as price-only or identity-only cards.
- Real shelf, glare, low-light, moving-belt and price-label accuracy still require a physical store benchmark.
- Barbora, Rimi and Livin can produce exact offers for their own matched SKUs. The checked-in Rimi layer contains 6,822 complete products after checking all 7,617 pages in the seven approved food and drink categories. Livin contributes 6 complete rows after checking its full 169-URL Latvia sitemap. These snapshots are not a market-wide real-time price engine.
- The release contains 500 complete Latvia-tagged Open Food Facts records in the isolated ODbL layer. The full official daily JSONL export is larger than 5 GB and belongs in a scheduled data job, not the web process.
- FatSecret Premier, NIQ Brandbank and GS1 Latvia access are not active until the providers approve the prepared evaluation requests.
- Grounded web nutrition has variable latency and cost. Production should persist human-reviewed successful results in Supabase.

## Supporting docs

- [Acceptance criteria](docs/acceptance.md)
- [Architecture and file map](docs/architecture.md)
- [Product QA](docs/product-qa.md)
- [Team handoff](docs/team-handoff.md)
- [Latvia coverage plan](docs/latvia-coverage-plan.md)
- [Catalog sources, licensing and refresh](docs/catalog-sources.md)
- [Partner data request drafts](docs/partner-data-requests.md)
- [Week-one lessons](docs/week-one-lessons.md)
- [Latest release evidence](docs/test-runs/2026-08-27-scanner-ui-catalog-completion.md)
- [Rounded camera viewport release evidence](docs/test-runs/2026-08-28-rounded-camera-viewport.md)
- [Aspect-correct thumbnail release evidence](docs/test-runs/2026-08-28-thumbnail-context-crop.md)
- [Great-fit-only alternatives release evidence](docs/test-runs/2026-08-28-great-fit-alternatives.md)
- [Final accumulated UI publish evidence](docs/test-runs/2026-08-28-accumulated-ui-publish.md)
- [Open and recent bugs](Bugs.md)
