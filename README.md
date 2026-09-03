# Sugar.no Live Scanner

Mobile-first Latvia proof of concept for identifying packaged groceries from a live camera or saved photo, comparing visible products with a transparent Sugar.no fit, and linking an exact product to a connected retailer when available.

- Production: [sugar-no-scanner-demo-production.up.railway.app](https://sugar-no-scanner-demo-production.up.railway.app)
- Repository: [github.com/seanastasiia/sugar-no-scanner-demo](https://github.com/seanastasiia/sugar-no-scanner-demo)
- Status: public investor concept with same-origin API safeguards, not a medical device or production-wide grocery catalog.

## Current product behavior

- The scanner follows the supplied Sugar.no iOS product screens: a cool light-gray app canvas, large white cards and sheets, subtle neutral separators, near-black typography/controls and system blue reserved for actions and focus. `Great fit`, `Moderate fit` and `Low fit` use filled, text-labelled semantic pills.
- The live feed spans the full phone width, with the Sugar.no brand, `Show demo` and recognition status layered over the camera. The stream keeps its native aspect ratio and `object-fit: contain`, so the app does not add digital zoom or stretch the image. Saved photos use one predictable rounded 3:4 preview and `object-fit: cover`; deterministic demo scenes keep their own designed framing.
- `Reading visible products…` means the browser has selected one stable frame. That captured frame is held on screen while recognition and nutrition enrichment finish, so camera movement cannot detach result boxes from the products that were actually analyzed. A new scene is read only after the user explicitly starts a new scan.
- Before Gemini returns, the browser may show neutral dashed candidate regions derived locally from edge detail. They are only aiming feedback: they never carry a product name, fit color or nutrition claim.
- Camera starts after permission without requiring a shutter action. Mobile Safari requests the rear 1920×1080 feed at up to 30 fps and continuous focus when the device exposes it. The first automatic capture waits at least 1.5 seconds after the video starts, giving the user time to position the phone and the camera time to focus; an explicit `Scan again` keeps the faster restart path.
- Frame-quality sampling starts after 340 ms, checks every 240 ms and sends one compact JPEG up to 960 px wide only after the initial 1.5-second positioning window and as soon as the scene is usable. A further 1.25-second hard capture ceiling prevents the sharpness/stability gate from stalling indefinitely on a soft or low-detail scene. The automatic loop pauses as soon as the frame is submitted, so one Gemini request is used per explicit scan and duplicate center/completion reads are not started.
- When the browser exposes native `BarcodeDetector`, EAN/UPC is resolved locally before Gemini. On Safari, Gemini can still return a visible barcode for the same exact local lookup.
- Live camera, saved shelf photo and checkout photo use the same recognition contract.
- Live and saved-photo views omit the redundant source badge. The camera keeps only `Show demo` over the feed; saved photos keep only `Back to live` over their fixed rounded 3:4 media frame.
- A scan keeps at most ten distinct, highest-confidence readable products. Repeated facings of one SKU are grouped.
- Rated products are ordered best fit first and use `Great fit`, `Moderate fit`, or `Low fit`.
- Expanded multi-product results use the ranked list as the single comparison view; they do not repeat the leading product in a second `Best fit in this scan` card.
- Expanded multi-product results keep `Best fit first` and the original ranked cards by default. An opt-in `Personal Shelf Rank · Pilot` switch opens the independent category comparison described below; duplicate scan-again controls remain omitted.
- The compact camera preview mirrors that ranking with `#1`, `#2`, `#3…` badges and shows the protein and total sugar used by Sugar.no fit per 100 g or 100 ml. When an exact source also lists total carbohydrates, the same row adds `Carbs`; missing carbohydrate data is simply omitted.
- Product thumbnails preserve the source photo proportions. When no exact retailer packshot exists, or a supplied packshot URL fails to load, the card falls back to the matching crop from the submitted scene. The crop keeps a little neighboring shelf context instead of stretching a tight detection box, and a broken-image icon is never left in the result.
- The compact sheet keeps `Scan again` beside `View all`. `Scan again` clears the captured result and starts a fresh live read; expanded comparison does not duplicate that control.
- When recognition cannot confidently return a result or the provider is temporarily unavailable, the camera shows one full-width blue `Not sure — try again` action instead of reusing the dark status-pill surface. White text, a visible border and pressed/focus feedback make it read as a button; the label stays on one line and starts a new explicit scan.
- `Great fit`, `Moderate fit` and `Low fit` camera markers use the same compact 24 px visual disc with thumbs-up, raised-hand and thumbs-down icons; the full detected-product outline remains the larger touch target. The outlined package also receives a transparent semantic tint (20% green/red, 22% yellow and 28% for the selected result), keeping the product visible while making the marker easier to read.
- The expanded comparison uses one downward-chevron control to return to the camera view.
- Original Sugar.no fit uses verified protein and total sugar per 100 g or 100 ml. Carbohydrates are informational and do not enter that formula. Fiber is not required or displayed in original Fit; the separate pilot uses it only where its category model requires it.
- Nutrition resolution order is: curated catalog, exact Barbora snapshot, strict Rimi/Livin Latvia snapshot, multilingual Livinn Lithuania SKU identity and nutrition snapshot, isolated Open Food Facts bulk/API match, then exact Google Search-grounded web nutrition.
- Internet enrichment runs after the first identity result and never receives or stores the camera image. Known barcode/catalog identities are enriched first, with up to five independent requests, so one slow unknown product does not hold the rest. A readable barcode or pack size is preferred, but a distinctive brand + product/variant identity may also use the exact fallback when Gemini preserves those details in its search query. Truly brand-only identities still fail fast. The final grounded-search fallback defaults to 12 seconds and is never configured below Google's 10-second minimum.
- Exact cited nutrition uses an immediate process cache plus the server-only Supabase `web_nutrition_cache`. A verified exact-SKU result is retained permanently and returned immediately; after 30 days it becomes due for a silent background recheck, not deletion. A failed recheck never replaces the last verified result. Unverified misses are retried after six hours, and immutable verified versions preserve the audit trail.
- The retired nutrition-label follow-up is removed from the UI and API; automatic exact-source enrichment is the only nutrition path.
- A confidently identified product remains visible while exact nutrition is being checked. An exact Livinn identity without complete nutrition stays as a neutral unrated result; only source-backed protein and total sugar can produce a Sugar.no fit. A shelf price by itself never creates a result card.
- Physical shelf price appears only from a clearly associated high-confidence EUR label.
- Product overlays use Gemini's native `box2d [ymin, xmin, ymax, xmax]` coordinates and exclude shelf labels and neighboring packages from the product box.
- A high-confidence Latvian comma-decimal shelf label can be accepted even when the printed `€` symbol is not readable; numbers printed on a package remain excluded.
- A crossed-out shelf price and full-width green `Buy cheaper online` action appear only when the exact connected-retailer SKU is currently cheaper. The compact price row and its accessibility copy stay retailer-neutral; the exact destination remains in the purchase link and its accessible label.
- Exact online offers stay inside the matching product card: the camera-read shelf price is crossed out beside the lower online price, while a full-width action repeats the destination price for a clear one-tap purchase.
- `Better alternatives` are fail-closed and selected from the complete verified nutrition pool: the managed/local Sugar.no catalog, Barbora, Rimi, Livin and the isolated Open Food Facts layer. They must share the same exact product type and form, have `Great fit` that is no worse than the scanned product, and resolve to a current exact offer from a connected retailer. Open Food Facts rows without an exact connected-retailer offer can strengthen recognition and nutrition coverage but cannot become purchasable alternatives. Equal-fit candidates are ordered by lower exact offer price and then the closest known pack size. `Moderate fit`, `Low fit` and unrated products are excluded; if no true substitute is available, the section is hidden.
- Offer lookup is retailer-neutral: exact Barbora, Rimi and Livin offer keys use one API contract. Every displayed price and destination belongs to that exact retailer SKU. The app never compares or labels fuzzy title matches as cheaper. `Buy cheaper online` and a crossed-out shelf price appear only when the exact current online offer is strictly below the observed shelf price; otherwise no saving claim is shown.
- Deterministic Shelf and Checkout demo scenes work without Gemini credentials.
- The demo chooser goes directly to Shelf demo, Checkout demo and saved-photo actions without a separate investor-coverage card.

## Personal Shelf Rank — isolated opt-in preview

The expanded result sheet now has an independent preference model for sugar, protein, food base and nutrient balance. The default Fit, camera overlays, compact preview, prices and Better alternatives are unchanged. The pilot compares only products of the same supported type in the current scan, shares equal places (1, 1, 3), and shows a score without a relative rank when only one product is scorable. Unknown ingredients, required nutrients or conflicting categories produce no score. Its neutral `/100` is a transparent product hypothesis, **not a validated health or safety rating**.

`Why this score?` exposes component points and weights, limiting-nutrient ceilings, original-language ingredients, the exact dated source and model version. No score is derived from the product name, price, ingredient count or E-number count; there is no automatic claim that an additive or processed product is harmful. Total sugars are used, not guessed added/free sugars. Allergens and individual medical suitability are outside this model.

Source consistency is a shared trust gate, not a new Fit formula. Exact carbohydrate/total-fat fields check macro totals (with 1 g rounding tolerance), sugar within carbs and saturates within fat. A demonstrably contradictory source table is retained for audit but receives neither pilot score nor original Fit. This quarantines Livinn `03000011074`, whose page reports 57.8 g protein + 47 g carbs + 29 g fat per 100 g; no decimal is silently “corrected.” Ordinary valid rows keep the original Fit formula and values.

The checked-in evidence pilot contains **198 exact retailer observations, 64 scorable** with `personal-shelf-v1.0-pilot`; 134 remain unscored. Supported types are chips, crackers/crispbreads, spoonable yogurts, dairy desserts, bars and cookies. The current batch has no dairy-dessert group. This is a coverage/calibration pilot, not the entire catalog. Source records retain Lithuanian/Latvian originals; deterministic ingredient rules also support English/Russian/Estonian, and unknown wording remains unknown. Category errors in retailer data still need auditing.

See [model, evidence and calibration rules](docs/personal-shelf-rank.md) for the full formula, scientific anchors versus product choices, reproducible sync/seed steps and owner checks. The pilot and preceding multilingual catalog batch are confined to the separate [owner preview](https://sugar-no-personal-rank-personal-rank-preview.up.railway.app), branch `codex/personal-rank-preview`. Production remains gated by the owner's explicit `ПУБЛИКУЙ`.

To try it, scan or upload a shelf photo, open `View all`, then enable `Personal Shelf Rank · Pilot`. Open `Why this score?` on a scored card; switch the pilot off to return to the original Fit. The existing Shelf/Checkout demos do not guarantee ingredient coverage for this new model. An unscored result is expected for products outside the 64 complete pilot records; it is not a low score.

The preview uses a new Railway environment and service, its own session signing inputs, and the checked-in catalog/evidence. It has no Supabase or Amplitude credentials and cannot write production catalog, cache or analytics data. Live recognition uses the existing Gemini account, so normal provider usage still applies; online results are cached only in this preview process and may be fetched again after a restart. The production and existing onboarding staging services are not changed.

## Trust rules

- Recognition confidence and nutrition confidence are separate.
- The app never estimates missing nutrition, converts a serving into per-100 values, or borrows data from another flavor or pack size.
- A possible retailer match cannot drive a price, purchase link, or fit.
- Camera frames are sent to Google Gemini for recognition. Sugar.no does not write them to analytics, logs or Supabase. This processing boundary is documented here and in the privacy contract rather than repeated as persistent camera chrome.
- The investor link opens the scanner directly. Its first same-origin page request receives a 12-hour HTTP-only, same-site session cookie so protected APIs remain unavailable to bare cross-origin calls. Recognition, enrichment, offer and analytics POST endpoints also reject cross-origin browser requests, bound request bodies and apply rate limits. This is request hardening, not viewer access control. The limiter key is a one-way hash of the client address and does not retain the address itself.
- Commercial availability never changes Sugar.no ranking.

## Stack

- Next.js 16, React 19, TypeScript
- Gemini for visual identity and optional Google Search-grounded exact nutrition
- Versioned curated, Barbora, Rimi, Livin Latvia and Livinn Lithuania snapshots in `data/`
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
- `GEMINI_MODEL`: general Gemini fallback used outside the dedicated live-recognition path.
- `GEMINI_RECOGNITION_MODEL`: optional live-recognition override; defaults to `gemini-3.5-flash` for the measured shelf speed/recall balance.
- `GEMINI_RECOGNITION_TIMEOUT_MS`: optional bounded Gemini request timeout (1,000–60,000 ms); defaults to 15,000 ms so a stalled provider call cannot hold the camera indefinitely.
- `GEMINI_WEB_NUTRITION_MODEL`: optional grounded-search model override.
- `GEMINI_WEB_NUTRITION_TIMEOUT_MS`: optional grounded-search deadline in milliseconds; defaults to `12000` and is clamped to Google's supported `10000` to `30000` range.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: optional server-only catalog and metadata analytics configuration. The service role key must never be exposed through a `NEXT_PUBLIC_` variable.
- `DEMO_ACCESS_CODE` and `DEMO_SESSION_SECRET`: server-only signing inputs for the silent 12-hour same-site session. Their presence does not create a user-facing access gate.
- `COMMIT_SHA`: fallback health metadata for direct Railway uploads.

Never commit real secrets. Railway stores production values.

## Commands

```bash
npm run dev                 # local development
npm run check:fast          # lint + typecheck + unit/integration tests
npm run test:e2e:smoke      # four critical Mobile Safari flows
npm run verify:catalog      # validate generated catalogs and Barbora fit coverage
npm run verify              # lint + typecheck + tests + catalog checks + production build
CI=1 npm run test:e2e       # complete Mobile Safari acceptance suite
npm run catalog:validate    # curated catalog validation
npm run catalog:sync:rimi  # low-rate Rimi page snapshot
npm run catalog:sync:livin # low-rate Livin page snapshot
npm run catalog:sync:livinn # full Livinn Lithuania edible-identity and nutrition snapshots
npm run catalog:sync:off-latvia # refresh a bounded Latvia OFF API snapshot
npm run catalog:import:off # import official OFF JSONL/JSONL.GZ into its isolated layer
npm run catalog:preload:nutrition # dry-run the Latvia preload; add -- --apply to warm Supabase
npm run supabase:seed:external # seed retailer and ODbL layers after migrations
npm run benchmark:recognition -- /absolute/path/photo.jpg
npm run benchmark:models -- /absolute/path/shelf.jpg /absolute/path/checkout.jpg
```

Use the project change lanes in `AGENTS.md`:

- docs/copy: diff and link check only;
- small UI: scoped checks plus smoke browser suite;
- local logic: related tests plus `check:fast`;
- recognition/scoring/privacy/auth/schema/dependency/release: `verify`, full browser suite, Railway deploy and production smoke.

## API

- `POST /api/recognize`: image data URL plus source type, returns bounded detections.
- `POST /api/barcode`: exact EAN/UPC without an image, resolved against local retailer/OFF layers.
- `POST /api/resolve-products`: up to ten image-free identities, returns optional exact retailer/nutrition enrichment. The client resolves up to five identities concurrently and applies each response independently, so one slow lookup does not hold already verified products. Brand-only identities never start the slow network fallbacks; a distinctive product/variant query can be resolved even when the concise UI label omits its pack details. Exact verified web results persist in Supabase and are served immediately while due rechecks run without blocking (six hours for unverified misses).
- `POST /api/offers`: bounded exact retailer keys for the displayed products and alternatives, returning current Barbora offers plus reproducible exact Rimi/Livin snapshot offers without blocking recognition.
- `POST /api/events`: metadata-only product events with image-like values rejected.
- `GET /api/health`: service, catalog and deployed commit status.

## Data and Supabase

Checked-in generated snapshots make the investor demo reproducible and fast:

- `data/catalog.generated.json`: curated comparison catalog.
- `data/barbora-product-index.generated.json`: broad checked-in retailer identity index used for recognition lookup only; it is not imported into the operational Supabase catalog.
- `data/barbora-food-product-index.generated.json`: checked-in food discovery subset used for local matching only; it is not imported into the operational Supabase catalog.
- `data/barbora-nutrition-index.generated.json`: the operational source-backed Barbora nutrition snapshot with exactly 7,433 exact SKUs containing both protein and total sugar.
- `data/rimi-catalog.generated.json`: exact Rimi product-page bootstrap snapshot.
- `data/livin-catalog.generated.json`: exact Livin product-page bootstrap snapshot.
- `data/livinn-food-index.generated.json`: 2,489 edible identities from the complete 5,926-URL canonical Livinn Lithuania product sitemap, including exact SKU/GTIN and source-provided Lithuanian, Latvian, Russian and Estonian aliases. Identity-only rows cannot receive a fit.
- `data/livinn-catalog.generated.json`: the 1,855-row nutrition-complete Livinn Lithuania subset with exact energy, protein and total sugar per 100 g or 100 ml.
- `data/rimi-catalog-sync-report.generated.json`, `data/livin-catalog-sync-report.generated.json` and `data/livinn-catalog-sync-report.generated.json`: complete configured-scope accounting.
- `data/open-food-facts-lv.generated.json`: attributed Latvia subset imported through the ODbL pipeline. Source-provided `product_name_*` values are retained as multilingual identity aliases rather than translated or discarded.
- `data/open-food-facts-regional.generated.json`: optional licensed Lithuania/Belarus OFF bulk layer. It stays empty until the official multi-gigabyte export is run as an approved durable data job.
- `data/catalog-sources.generated.json`: source, license and redistribution manifest.
- `data/personal-shelf-evidence.generated.json`: separate 198-row exact retailer ingredient/salt/saturated-fat/fiber observations for the opt-in pilot. Missing values are null; QA fixtures are not included.

Regeneration and validation scripts live in `scripts/`. Supabase migrations and seed tooling live in `supabase/`. Do not hand-edit generated JSON. Rimi/Livin/Livinn snapshots are for the private proof of concept; production reuse and recurring ingestion require retailer permission. Open Food Facts rows stay logically and physically separate because of ODbL obligations. See [catalog sources](docs/catalog-sources.md).

Apply all migrations through `supabase/migrations/202609020001_livinn_multilingual_catalog.sql` before seeding. The carbohydrate migration is nullable and additive; it does not rewrite existing nutrition or recalculate Sugar.no fit. The multilingual migrations add only source-backed aliases and search indexes. Livinn food identities live separately from nutrition-complete rows, so missing nutrients remain missing instead of becoming zero or an estimated fit. Existing snapshots created before these migrations continue to work and omit newly supported fields until their next source refresh. The RLS-protected current tables retain verified exact-SKU nutrition permanently; `revalidate_after` is a freshness deadline, never a deletion date. Web sources are due after 30 days, retailer nutrition after 90 days, manufacturer or label evidence after 180 days, and prices after 24 hours. Append-only version tables preserve verified history, and a failed refresh cannot overwrite a previous success. The operational Barbora table is pruned to exactly the 7,433 nutrition-complete SKUs during `npm run supabase:seed:external`; the wider Livinn edible identity index is seeded into its dedicated table and pruned to the checked-in snapshot. No table stores camera images.

Use `npm run supabase:seed:external:dry-run` to verify the checked-in Barbora snapshot without writing data, `npm run supabase:seed:external` to reproduce the managed import, and `npm run supabase:verify:external` to assert that Supabase contains exactly 7,433 current and nutrition-complete Barbora rows plus their immutable versions.

Run `npm run catalog:preload:nutrition` to inspect the Latvia demo list, then add `-- --apply` with server credentials to warm exact web results. An unverified miss is cached for six hours only; this avoids repeated searches without inventing values.

Connected-retailer resolution runs before Open Food Facts and grounded web lookup. The Rimi matcher normalizes a small audited set of English package labels to their Latvian catalog identity while still requiring the same brand, pack size and an unambiguous top candidate. Livinn keeps source-provided alternate-language URL names under one SKU and GTIN; an English, Russian, Latvian or Lithuanian read can therefore supply the same canonical identity to later nutrition lookup. Open Food Facts evaluates every source-provided product-name language for the same GTIN. Both growing catalogs are indexed by brand/barcode, so multilingual matching does not scan every row. A language alias never bypasses brand, variant, pack-size, nutrition-completeness or ambiguity checks.

The managed `products` table is optional in this proof of concept. If it has not been migrated and seeded, or is empty, product recognition and barcode lookup continue from the checked-in scored catalog while `web_nutrition_cache` still uses Supabase independently.

For the separate shelf pilot, additionally apply `supabase/migrations/202609030001_personal_shelf_evidence.sql` and review `npm run supabase:seed:shelf-pilot` (dry-run). With the approved Supabase target and server credentials, `npm run supabase:seed:shelf-pilot -- --apply` upserts the isolated retailer/OFF evidence tables and verifies readback without deleting rows. These migrations and writes have **not** been applied to production for this pilot. The optional `/api/personal-shelf` reads at most ten exact IDs only when the pilot opens; absent/offline/unseeded Supabase falls back to local observations within a two-second read deadline. It does not scrape, store images or delay recognition.

## Railway release

### Isolated Personal Shelf Rank preview

This owner-approved preview is an exception to the normal `main` release lane: **do not push it to `main` or deploy it to either existing scanner service**. Its empty environment was created without duplicating production variables. Target project `9e2a4887-0e19-4ca7-ae99-d68816542558`, environment `personal-rank-preview` (`f83202e1-6a66-4311-b16d-c7ec3fe95541`), service `sugar-no-personal-rank` (`37730464-07ba-482d-9c59-74c04ecdf6db`).

After verification, upload only a clean, GitHub-backed preview commit. Always pass these explicit selectors:

```bash
git push origin HEAD:codex/personal-rank-preview
npx @railway/cli variable set COMMIT_SHA=$(git rev-parse HEAD) --skip-deploys \
  --project 9e2a4887-0e19-4ca7-ae99-d68816542558 \
  --service 37730464-07ba-482d-9c59-74c04ecdf6db --environment personal-rank-preview
npx @railway/cli up --detach \
  --project 9e2a4887-0e19-4ca7-ae99-d68816542558 \
  --service 37730464-07ba-482d-9c59-74c04ecdf6db --environment personal-rank-preview
```

Wait for deployment `SUCCESS`, verify preview `/api/health` matches the uploaded commit, test direct entry, protected API boundaries and the pilot toggle, and recheck both existing URLs against their pre-deploy SHAs. Do not seed/migrate a database for this preview. A preview rollback redeploys an earlier preview commit to this same service only; it must not use the production rollback lane.

### Production — requires separate approval

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

Then verify `/api/health`, direct root entry plus its silent session cookie, rejection of a bare unauthenticated API request, one critical recognition path and the no-image-storage contract. Docs-only changes do not require a Railway release unless explicitly requested.

## Product check

1. Open production in iPhone Safari. Confirm it opens the scanner directly with no code page, then allow camera access.
2. Confirm the live camera spans the full screen width. The Sugar.no logo, `Show demo` and recognition status must sit over the feed; `Live camera` and the persistent `Sent to Google Gemini…` line must be absent. The image must not look digitally zoomed or stretched.
3. Scan a shelf with more than ten visible products and confirm no more than ten distinct results appear.
4. Confirm verified results gain fit labels and every confidently named product remains in the list after lookup. An unresolved product must stay neutral with no invented fit; an anonymous price-only finding must stay hidden.
5. In the collapsed result sheet, tap `Scan again`. Confirm the captured result clears and the live camera starts a fresh scan; `View all` must still open the ranked comparison.
6. Open Shelf and Checkout demos and expand `View all`.
7. Confirm the expanded comparison begins with `Best fit first` and the ranked cards, without duplicate summaries, rated counters or a second scan-again button.
7a. Confirm every rated card visibly shows `Protein …g · Sugar …g` and adds `Carbs …g` only when the exact source provides carbohydrates; the numbers are per 100 g or 100 ml and protein remains part of the unchanged two-signal fit.
7b. In the isolated preview, enable `Personal Shelf Rank`. Check within-category places, a neutral unscored card for missing fields, and `Why this score?` with original ingredients/source. Switch it off: the original order and Fit values must return unchanged. Follow the dedicated [pilot product checklist](docs/personal-shelf-rank.md#owner-product-check) before approving production publication.
8. Confirm a physical price appears only when a price label is visible and an exact cheaper Barbora result is clearly qualified.
9. Confirm each overlay tightly follows its package rather than a nearby shelf label.
10. Wait until `Reading visible products…` appears, then move the phone or close the shelf/fridge. Confirm the submitted frame remains frozen and every box stays attached to the product that was analyzed. Confirm no new scene is read until the explicit retry/new-scan action is used.
11. Open a rated product and confirm `Better alternatives` contains only the same product type with `Great fit` no worse than the source and a live price; `Moderate fit`, `Low fit`, unrated products, and products without a valid substitute should show no alternatives block.
12. Scan the Rimi private-label examples `Pastry twists SALTY 125g`, `Pastry twists CHEESE 125g`, `multi fruit 200ml` and `strawberry banana 200ml`; confirm they resolve from the connected Rimi snapshot rather than waiting for cited web nutrition.
13. Confirm camera markers use equally sized compact icons: thumbs-up for Great fit, raised hand for Moderate fit and thumbs-down for Low fit; tapping anywhere inside the outlined package still opens the product.
14. Scan a product without an exact packshot, or with a retailer image that cannot load. Confirm its preview uses the matching crop from the captured scene, keeps the package proportions and never shows a broken-image icon; a little neighboring shelf context is acceptable.
15. Confirm a purchase button is absent when the exact online offer is not cheaper than the visible shelf price; when it is cheaper, confirm the card shows one full-width green `Buy cheaper online` action.
16. Scan exact Rimi and Livin products and confirm their retailer packshots load instead of a broken-image icon.
17. Scan a brand-only package and confirm it fails fast; then scan a distinctive variant whose concise title omits the size but whose package text is readable, and confirm the exact fallback may still resolve it without borrowing nutrition from a sibling SKU.
17a. Scan one exact Open Food Facts SKU that has both English and Latvian or Russian names. Confirm either visible language resolves the same GTIN and nutrition; a different variant or pack size must remain unresolved.
17b. Scan or upload the Bett'r `Brown Rice Cakes Himalayan Salt 120 g` package in English, Russian or a Baltic-language listing. Confirm every language resolves Livinn SKU `1G1701009280`; repeated language readings must collapse into one result. Then scan a Livinn food identity without complete nutrition and confirm it remains neutral with no fit.
18. Upload one landscape and one tall portrait shelf photo; confirm both use the same rounded 3:4 preview, fill it with an undistorted center crop and remain inside the viewport.
19. Confirm each rated package outline has a light green, yellow or red transparent fill matching its fit icon; the packaging must remain readable through the tint.
20. Scan an exact SKU that previously resolved through cited web nutrition twice. Confirm the repeat result appears immediately. A result older than its freshness window must remain visible while its recheck happens silently, and an unsuccessful recheck must not remove its fit.
21. Before the first AI result, confirm any locally proposed regions are neutral dashed outlines only. Green, yellow or red styling may appear only after an exact recognized product has verified nutrition.
22. Point the camera at a scene that cannot be confidently recognized, or temporarily interrupt recognition. Confirm the bottom status becomes one full-width blue `Not sure — try again` button with white text on one line, then confirm tapping it starts a fresh scan.
23. Reload production and allow the camera. Confirm the first automatic read waits about 1.5 seconds after the live video appears, leaving enough time to aim at the shelf; then confirm `Scan again` still begins the next read promptly.

## Known limits

- Latvia-wide nutrition coverage is not guaranteed. Private labels, unreadable variants and products without an exact public per-100 table can remain as clearly unrated visual identities in the comparison. They never receive an invented fit or retailer claim; anonymous price-only findings stay hidden.
- Real shelf, glare, low-light, moving-belt and price-label accuracy still require a physical store benchmark.
- Barbora, Rimi and Livin Latvia can produce exact offers for their own matched SKUs. The checked-in Rimi layer contains 6,822 complete products after checking all 7,617 pages in the seven approved food and drink categories. Livin Latvia contributes 6 complete rows after checking its full 169-URL sitemap. Livinn Lithuania contributes 2,489 edible identities after accounting for all 5,926 canonical product URLs; 1,855 have complete Fit nutrition and 634 remain explicitly unrated. Lithuanian offers are not presented as Latvia purchase actions. These snapshots are not a market-wide real-time price engine.
- The checked-in layer contains 500 complete Latvia-tagged Open Food Facts records, including 119 with at least one source-provided alternate name after the 31 August refresh. The separate Lithuania/Belarus ODbL snapshot is prepared but remains empty until an approved large-data run. The official daily JSONL export was 12.8 GB compressed on 31 August 2026 and belongs in a scheduled data job with durable storage, not the web process, Railway build or an unapproved laptop download.
- FatSecret Premier, NIQ Brandbank and GS1 Latvia access are not active until the providers approve the prepared evaluation requests.
- Grounded web nutrition has variable latency and cost. It runs only for an identity with a readable barcode/pack size or sufficiently distinctive brand + product/variant evidence, and defaults to a 12-second deadline. Persistent reuse requires the checked-in Supabase migration plus server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; without them the app fails open to its process cache and recognition still works.
- Browser-native barcode detection depends on platform support. Safari currently relies on Gemini reading the visible code; no extra WASM bundle is shipped because it would increase camera startup cost.
- Live overlays are drawn over one captured recognition frame, not native AR object tracking. They do not follow a moving package or changing scene. Exact identity comes from the submitted Gemini frame, and the user explicitly starts a new scan for a new shelf view.
- The investor URL has no viewer access gate. The silent same-site cookie, origin checks and process-local limiters harden API use but do not make the link private. Production scale-out needs explicit authentication plus a shared counter or edge gateway quota in addition to Gemini project budgets.
- The five-shelf model screen measures unique returned identities, not labeled ground-truth recall. Gemini 3.5 Flash returned 38 identities at 7.1 s mean; a lean schema was faster (4.2 s) but returned fewer and unstable results (30, then 24), so it was rejected. Gemini 3.6 returned 32 at 7.8 s. True precision/recall still requires a labeled physical-store dataset.

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
- [Production cleanup and golden-release verification](docs/test-runs/2026-08-30-production-cleanup.md)
- [Carbohydrate display release evidence](docs/test-runs/2026-08-30-carbohydrate-display-release.md)
- [Rounded camera viewport release evidence](docs/test-runs/2026-08-28-rounded-camera-viewport.md)
- [Aspect-correct thumbnail release evidence](docs/test-runs/2026-08-28-thumbnail-context-crop.md)
- [Great-fit-only alternatives release evidence](docs/test-runs/2026-08-28-great-fit-alternatives.md)
- [Final accumulated UI publish evidence](docs/test-runs/2026-08-28-accumulated-ui-publish.md)
- [Camera framing and fit-overlay release evidence](docs/test-runs/2026-08-28-camera-framing-fit-overlays.md)
- [Physical shelf autofocus and recognition release evidence](docs/test-runs/2026-08-28-physical-shelf-autofocus-recognition.md)
- [Final release audit and production evidence](docs/test-runs/2026-08-29-final-release-audit.md)
- [Public entry and full-width live camera release evidence](docs/test-runs/2026-08-29-public-entry-full-width-camera.md)
- [Recognition speed, cache and barcode release evidence](docs/test-runs/2026-08-29-recognition-speed-six.md)
- [Captured-frame and alternative-link release evidence](docs/test-runs/2026-08-29-captured-frame-alternative-links.md)
- [Superseded live camera tracking experiment](docs/test-runs/2026-08-29-live-camera-tracking.md)
- [Captured-frame scan release evidence](docs/test-runs/2026-08-30-captured-frame-scan.md)
- [Scan again and exact web-fallback release evidence](docs/test-runs/2026-08-30-scan-again-web-fallback.md)
- [Cross-retailer alternatives release evidence](docs/test-runs/2026-08-31-cross-retailer-alternatives.md)
- [Thumbnail failure fallback and camera retry release evidence](docs/test-runs/2026-08-31-thumbnail-fallback-retry.md)
- [Initial camera positioning delay release evidence](docs/test-runs/2026-09-02-camera-initial-focus-delay.md)
- [Camera retry button color release evidence](docs/test-runs/2026-09-02-camera-retry-button-color.md)
- [Multilingual Livinn coverage and protein-card local QA](docs/test-runs/2026-09-02-multilingual-livinn-protein-local.md)
- [Open and recent bugs](Bugs.md)
