# Sugar.no Live Scanner

Mobile-first Latvia proof of concept for identifying packaged groceries from a live camera or saved photo, comparing visible products with a transparent Sugar.no fit, and linking an exact product to a connected retailer when available.

- Production: [sugar-no-scanner-demo-production.up.railway.app](https://sugar-no-scanner-demo-production.up.railway.app)
- Repository: [github.com/seanastasiia/sugar-no-scanner-demo](https://github.com/seanastasiia/sugar-no-scanner-demo)
- Status: public investor concept with same-origin API safeguards, not a medical device or production-wide grocery catalog.

## Stage 1 staging pilot

The staging scanner implements the 21 approved Pen screen/state designs from 3 September 2026. Open [the staging preview](https://sugar-no-scanner-staging-staging.up.railway.app/?onboarding=1).

- Welcome, camera, compact comparison, full ranked list, individual product details, demo chooser, saved photo, recovery states and feedback share the approved tokens in `design-system/sugar-no-shelf-scanner/MASTER.md`.
- Headings, controls and fit labels use the system rounded face (SF Pro Rounded in Apple Safari). Body text uses the regular system face (SF Pro on Apple). Font binaries are not redistributed. Browsers without the rounded system face use their system fallback, so typography there is not pixel-identical to Pen.
- The approved light palette is kept in both system themes. Primary actions have the black gradient, white gradient rim and shadow; Great/Moderate/Low fit labels use the approved colored gradients and 1.25 px rims. Increased-contrast mode darkens chip text and blue actions; the original white fit labels do not meet normal-mode AA contrast.
- Welcome uses the clean shelf photo with native overlays and one 3.2-second scan-line pass. Reduced-motion mode removes it. Camera permission is requested only after `Open camera`; the sample does not request camera access.
- Photo measurements begin when the scanner appears after onboarding and update on resize, keeping product outlines aligned with the contained photo on phones and wide screens.
- Completion stays under `sugar_scanner_onboarding_v1`; `?onboarding=1` forces the welcome screen. Analytics reports onboarding version `4`, without forcing existing users through onboarding again.
- The compact sheet has four ranked tiles plus `Scan again` and `View all`. A tile opens that product; the full list opens each product's detail screen, with a return to the list. Exact-source Carbs remain optional and never change fit.
- The four demo SKUs have the approved short display names and local packshots. Original catalog identity, product IDs, nutrition, prices and analytics data remain unchanged; other SKUs retain their own source names and images.
- Anonymous feedback supports rating, reason and an optional 300-character comment. Saving locks the form; retry preserves the answer, and closing returns keyboard focus to the feedback control.
- Supabase and the separate EU Amplitude project `Shelf Scanner - Staging` keep their existing privacy-safe event contracts. No schema, secrets, catalog or recognition-provider settings are changed by the design transfer.

Stage 1 stays on `stage/onboarding-feedback` and must not merge into `main` or deploy to production until the explicit command `ПУБЛИКУЙ`. Rollback tags are `production-baseline-2026-08-31` and `scanner-golden-3c83a65`. Apply `supabase/migrations/202608310002_pilot_feedback.sql` only to the separate staging Supabase project during Stage 1 validation.

## Current product behavior

- The scanner follows the approved Pen designs derived from the Sugar.no iOS product screens: a cool light-gray app canvas, large white cards and sheets, subtle neutral separators, near-black typography/controls and system blue reserved for actions and focus. `Great fit`, `Moderate fit` and `Low fit` use text-labelled gradient pills with a white gradient rim.
- The live feed spans the phone width below the light header with the official Sugar.no wordmark and `Leave feedback`. `Show demo` and recognition status sit over the media. All media uses `object-fit: contain`; recognition boxes use that same coordinate mapping, so no crop, digital zoom or stretch is introduced. Saved-photo and checkout previews use an adaptive rounded frame.
- `Reading visible products…` means the browser has selected one stable frame. That captured frame is held on screen while recognition and nutrition enrichment finish, so camera movement cannot detach result boxes from the products that were actually analyzed. A new scene is read only after the user explicitly starts a new scan.
- Before Gemini returns, the browser may show neutral outlined candidate regions derived locally from edge detail. They are only aiming feedback: they never carry a product name, fit color or nutrition claim.
- Camera starts after permission without requiring a shutter action. Mobile Safari requests the rear 1920×1080 feed at up to 30 fps and continuous focus when the device exposes it.
- Live sampling starts after 340 ms, checks every 240 ms and sends one compact JPEG up to 960 px wide as soon as the scene is usable. A 1.25-second hard capture ceiling prevents the sharpness/stability gate from stalling indefinitely. The automatic loop pauses as soon as the frame is submitted, so one Gemini request is used per explicit scan and duplicate center/completion reads are not started.
- When the browser exposes native `BarcodeDetector`, EAN/UPC is resolved locally before Gemini. On Safari, Gemini can still return a visible barcode for the same exact local lookup.
- Live camera, saved shelf photo and checkout photo use the same recognition contract.
- Live and saved-photo views omit the redundant source badge. The camera keeps only `Show demo` over the feed; saved photos keep only `Back to live` over their adaptive rounded media frame.
- A scan keeps at most ten distinct, highest-confidence readable products. Repeated facings of one SKU are grouped.
- Rated products are ordered best fit first and use `Great fit`, `Moderate fit`, or `Low fit`.
- Expanded multi-product results use the ranked list as the single comparison view; they do not repeat the leading product in a second `Best fit in this scan` card.
- Expanded multi-product results start with the wordmark, collapse control, `Best fit first`, per-100 basis and ranked cards. Tapping a product opens its detail screen. Eligible Better alternatives remain available below the main content.
- The compact camera preview shows the leading four products in a two-column grid, with rank, display name, fit and total sugar. Its heading states the per-100 basis; mixed food/drink lists label individual rows in the expanded view. Exact-source Carbs remain visible when supplied; missing carbohydrate data is omitted.
- Product thumbnails preserve the source photo proportions. When no exact retailer packshot exists, or a supplied packshot URL fails to load, the card falls back to the matching crop from the submitted scene. The crop keeps a little neighboring shelf context instead of stretching a tight detection box, and a broken-image icon is never left in the result.
- The compact sheet keeps `Scan again` beside `View all`. `Scan again` clears the captured result and starts a fresh live read; expanded comparison does not duplicate that control.
- Uncertain recognition, provider unavailability, camera denial and offline mode have a clear recovery panel. `Not sure — try again` stays coral; service retry uses the primary black button. Both start an explicit retry without changing the automatic request limits.
- Fit camera markers use equal 28 px icon discs with thumbs-up, raised-hand and thumbs-down icons. The package outline remains the larger touch target, with a restrained 10% semantic tint. Pending candidates stay neutral.
- The expanded comparison uses one downward-chevron control to return to the camera view.
- Sugar.no fit uses verified protein and total sugar per 100 g or 100 ml. Carbohydrates are an optional informational value and never enter the fit formula, thresholds or ranking. Fiber is not required or displayed.
- Nutrition resolution order is: curated catalog, exact Barbora snapshot, strict Rimi/Livin snapshot, isolated Open Food Facts bulk/API match, then exact Google Search-grounded web nutrition.
- Internet enrichment runs after the first identity result and never receives or stores the camera image. Known barcode/catalog identities are enriched first, with up to five independent requests, so one slow unknown product does not hold the rest. A readable barcode or pack size is preferred, but a distinctive brand + product/variant identity may also use the exact fallback when Gemini preserves those details in its search query. Truly brand-only identities still fail fast. The final grounded-search fallback defaults to 12 seconds and is never configured below Google's 10-second minimum.
- Exact cited nutrition uses an immediate process cache plus the server-only Supabase `web_nutrition_cache`. A verified exact-SKU result is retained permanently and returned immediately; after 30 days it becomes due for a silent background recheck, not deletion. A failed recheck never replaces the last verified result. Unverified misses are retried after six hours, and immutable verified versions preserve the audit trail.
- The retired nutrition-label follow-up is removed from the UI and API; automatic exact-source enrichment is the only nutrition path.
- A product remains visible while exact nutrition is being checked, then stays in the result only when source-backed protein and total sugar produce a Sugar.no fit. A shelf price by itself never creates a result card.
- Physical shelf price appears only from a clearly associated high-confidence EUR label.
- Product overlays use Gemini's native `box2d [ymin, xmin, ymax, xmax]` coordinates and exclude shelf labels and neighboring packages from the product box.
- A high-confidence Latvian comma-decimal shelf label can be accepted even when the printed `€` symbol is not readable; numbers printed on a package remain excluded.
- A crossed-out shelf price and full-width black-gradient `Buy cheaper online` action appear in the ranked card only when the exact connected-retailer SKU is currently cheaper. The detail view shows the same comparison with `Open retailer`. No saving or purchase action is invented when shelf price or exact identity is missing.
- Exact online offers stay inside the matching product card: the camera-read shelf price is crossed out beside the lower online price, while a full-width action repeats the destination price for a clear one-tap purchase.
- `Better alternatives` are fail-closed and selected from the complete verified nutrition pool: the managed/local Sugar.no catalog, Barbora, Rimi, Livin and the isolated Open Food Facts layer. They must share the same exact product type and form, have `Great fit` that is no worse than the scanned product, and resolve to a current exact offer from a connected retailer. Open Food Facts rows without an exact connected-retailer offer can strengthen recognition and nutrition coverage but cannot become purchasable alternatives. Equal-fit candidates are ordered by lower exact offer price and then the closest known pack size. `Moderate fit`, `Low fit` and unrated products are excluded; if no true substitute is available, the section is hidden.
- Offer lookup is retailer-neutral: exact Barbora, Rimi and Livin offer keys use one API contract. Every displayed price and destination belongs to that exact retailer SKU. The app never compares or labels fuzzy title matches as cheaper. `Buy cheaper online` and a crossed-out shelf price appear only when the exact current online offer is strictly below the observed shelf price; otherwise no saving claim is shown.
- Deterministic Shelf and Checkout demo scenes work without Gemini credentials.
- The demo chooser is a light full-screen surface with three white option cards, blue icons and a black primary return action.

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
- `GEMINI_MODEL`: general Gemini fallback used outside the dedicated live-recognition path.
- `GEMINI_RECOGNITION_MODEL`: optional live-recognition override; defaults to `gemini-3.5-flash` for the measured shelf speed/recall balance.
- `GEMINI_RECOGNITION_TIMEOUT_MS`: optional bounded Gemini request timeout (1,000–60,000 ms); defaults to 15,000 ms so a stalled provider call cannot hold the camera indefinitely.
- `GEMINI_WEB_NUTRITION_MODEL`: optional grounded-search model override.
- `GEMINI_WEB_NUTRITION_TIMEOUT_MS`: optional grounded-search deadline in milliseconds; defaults to `12000` and is clamped to Google's supported `10000` to `30000` range.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: optional server-only catalog and metadata analytics configuration. The service role key must never be exposed through a `NEXT_PUBLIC_` variable.
- `AMPLITUDE_API_KEY`: optional server-only Amplitude project key. When present, `/api/events` mirrors approved anonymous properties to the EU ingestion endpoint after storing the complete event in Supabase. Amplitude failure is non-blocking.
- `AMPLITUDE_ENVIRONMENT`: environment label attached to Amplitude events; use `staging` for the pilot.
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
- `POST /api/feedback`: bounded anonymous pilot feedback; comments are optional, limited to 300 characters, and image-like content is rejected.
- `GET /api/health`: service, catalog and deployed commit status.

## Data and Supabase

Checked-in generated snapshots make the investor demo reproducible and fast:

- `data/catalog.generated.json`: curated comparison catalog.
- `data/barbora-product-index.generated.json`: broad checked-in retailer identity index used for recognition lookup only; it is not imported into the operational Supabase catalog.
- `data/barbora-food-product-index.generated.json`: checked-in food discovery subset used for local matching only; it is not imported into the operational Supabase catalog.
- `data/barbora-nutrition-index.generated.json`: the operational source-backed Barbora nutrition snapshot with exactly 7,433 exact SKUs containing both protein and total sugar.
- `data/rimi-catalog.generated.json`: exact Rimi product-page bootstrap snapshot.
- `data/livin-catalog.generated.json`: exact Livin product-page bootstrap snapshot.
- `data/rimi-catalog-sync-report.generated.json` and `data/livin-catalog-sync-report.generated.json`: complete configured-scope accounting.
- `data/open-food-facts-lv.generated.json`: attributed Latvia subset imported through the ODbL bulk pipeline.
- `data/catalog-sources.generated.json`: source, license and redistribution manifest.

Regeneration and validation scripts live in `scripts/`. Supabase migrations and seed tooling live in `supabase/`. Do not hand-edit generated JSON. Rimi/Livin snapshots are for the private proof of concept; production reuse and recurring ingestion require retailer permission. Open Food Facts rows stay logically and physically separate because of ODbL obligations. See [catalog sources](docs/catalog-sources.md).

Apply all migrations through `supabase/migrations/202608300001_carbohydrate_per_100.sql` before seeding. The carbohydrate migration is nullable and additive; it does not rewrite existing nutrition or recalculate Sugar.no fit. Existing snapshots created before this migration continue to work and omit `Carbs` until their next source refresh supplies an exact per-100 value. The RLS-protected current tables retain verified exact-SKU nutrition permanently; `revalidate_after` is a freshness deadline, never a deletion date. Web sources are due after 30 days, retailer nutrition after 90 days, manufacturer or label evidence after 180 days, and prices after 24 hours. Append-only version tables preserve verified history, and a failed refresh cannot overwrite a previous success. The operational Barbora table is pruned to exactly the 7,433 nutrition-complete SKUs during `npm run supabase:seed:external`; wider discovery-only indexes remain checked in for recognition but are not copied to Supabase. No table stores camera images.

Use `npm run supabase:seed:external:dry-run` to verify the checked-in Barbora snapshot without writing data, `npm run supabase:seed:external` to reproduce the managed import, and `npm run supabase:verify:external` to assert that Supabase contains exactly 7,433 current and nutrition-complete Barbora rows plus their immutable versions.

Run `npm run catalog:preload:nutrition` to inspect the Latvia demo list, then add `-- --apply` with server credentials to warm exact web results. An unverified miss is cached for six hours only; this avoids repeated searches without inventing values.

Connected-retailer resolution runs before Open Food Facts and grounded web lookup. The Rimi matcher normalizes a small audited set of English package labels to their Latvian catalog identity while still requiring the same brand, pack size and an unambiguous top candidate. A translated identity that remains ambiguous is not accepted and may proceed to the bounded fallback chain.

The managed `products` table is optional in this proof of concept. If it has not been migrated and seeded, or is empty, product recognition and barcode lookup continue from the checked-in scored catalog while `web_nutrition_cache` still uses Supabase independently.

## Railway release

Stage 1 uses the existing Railway project’s separate `staging` environment. Deploy the `stage/onboarding-feedback` worktree only with `--environment staging`, give it its own Railway domain, and set `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from the separate staging Supabase project. Store the `Shelf Scanner - Staging` EU project key as the server-only `AMPLITUDE_API_KEY` and set `AMPLITUDE_ENVIRONMENT=staging`. Never copy production Supabase or Amplitude values into staging, and never use a `NEXT_PUBLIC_` analytics key. Verify the deployed branch through `/api/health` before product QA.

For this staging-only design batch, push the reviewed commit to `stage/onboarding-feedback` and use the explicit staging target for a direct upload:

```bash
git push origin HEAD:stage/onboarding-feedback
railway variable set COMMIT_SHA=$(git rev-parse HEAD) --skip-deploys \
  --project 9e2a4887-0e19-4ca7-ae99-d68816542558 \
  --service sugar-no-scanner-staging --environment staging
railway up --detach \
  --project 9e2a4887-0e19-4ca7-ae99-d68816542558 \
  --service sugar-no-scanner-staging --environment staging
```

Wait for Railway `SUCCESS`, then compare staging `/api/health` SHA to GitHub and run the product smoke. Production remains gated by `ПУБЛИКУЙ`.

Supabase and Amplitude have different jobs. Supabase retains the complete accepted event, including an optional observed product identity in bounded JSON metadata for debugging. The relational `product_id` field is reserved for IDs that are guaranteed to exist in the managed `products` table; visual, demo and external-retailer identities never enter that foreign-key field. Amplitude receives only the event name, anonymous session UUID as `device_id`, source, environment, and a strict allowlist of funnel properties such as onboarding step, recognized count, latency bucket, confidence, feedback helpfulness, and error category. It never receives photos, OCR, feedback comments, email, raw user-agent strings, or exact product IDs. The event UUID becomes Amplitude `insert_id` so retries are deduplicated.

The first saved Amplitude chart is `Shelf Scanner Activation: Open → Scan Completed`, measuring `app_opened` to `scan_completed` within one day. Amplitude Starter currently limits Funnel charts to two steps, so onboarding, camera-permission and feedback diagnostics remain visible as separate events rather than being added as intermediate steps to this chart.

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

1. Open [staging with welcome forced](https://sugar-no-scanner-staging-staging.up.railway.app/?onboarding=1) in iPhone Safari. Compare welcome typography, fit-chip rims and black buttons to Pen. Try a small phone and landscape.
2. Choose `Try a sample shelf` → `View all` → `Salty Peanut`. Confirm the four ranked products, source nutrition, crossed-out €3.49 / €2.79 example, `Open retailer`, and return to the list. The retailer action opens a new tab.
3. Return to camera; choose Checkout demo or a saved photo. Confirm the whole image is shown, package outlines follow the image, and unknown nutrition remains neutral. Test live recognition on the phone with an actual shelf; automated camera tests do not replace a real-store accuracy check.
4. Open `Leave feedback`. Check Needs work, reason, optional comment, success and closing. Keyboard users can stay inside the dialog and return to the trigger. A failed send preserves the answer for retry.
5. Deny camera permission or disconnect the network and confirm a useful recovery action. Photos must not appear in analytics or persistence.

Technical validation uses `npm run verify` and the Mobile Safari suite (`CI=1 E2E_PORT=3012 npm run test:e2e`). `E2E_PORT` defaults to 3000 and lets an isolated checkout avoid another project's running server. Screenshots and validation logs are stored under ignored `test-results/`; browser tests mock external failures and feedback writes. Production-build API/session smoke runs on staging HTTPS; Mobile Safari does not send the production Secure cookie to a local HTTP origin.
