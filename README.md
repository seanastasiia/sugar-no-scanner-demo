# Sugar.no Live Scanner

Mobile-first Latvia proof of concept for identifying packaged groceries from a live camera or saved photo, comparing visible products with a transparent Sugar.no fit, and linking an exact product to a connected retailer when available.

- Production: [sugar-no-scanner-demo-production.up.railway.app](https://sugar-no-scanner-demo-production.up.railway.app)
- Repository: [github.com/seanastasiia/sugar-no-scanner-demo](https://github.com/seanastasiia/sugar-no-scanner-demo)
- Status: public investor concept with same-origin API safeguards, not a medical device or production-wide grocery catalog.

## Approved Pen release

The scanner implements the approved Pen screen/state designs from 3 September 2026. Open [production with welcome forced](https://sugar-no-scanner-demo-production.up.railway.app/?onboarding=1). The release combines Pen `c151e92` with the existing production catalog, shared web cards and opt-in Personal Shelf Rank, rather than reverting production to the old staging baseline.

- Welcome, camera, compact comparison, full ranked list, individual product details, demo chooser, saved photo, recovery states and feedback share the approved tokens in `design-system/sugar-no-shelf-scanner/MASTER.md`.
- Headings, controls and fit labels use the system rounded face (SF Pro Rounded in Apple Safari). Body text uses the regular system face (SF Pro on Apple). Font binaries are not redistributed. Browsers without the rounded system face use their system fallback, so typography there is not pixel-identical to Pen.
- The approved light palette is kept in both system themes. Primary actions have the black gradient, white gradient rim and shadow; Great/Moderate/Low fit labels use the approved colored gradients and 1.25 px rims. Increased-contrast mode darkens chip text and blue actions; the original white fit labels do not meet normal-mode AA contrast.
- Welcome uses the clean shelf photo with native overlays and one 3.2-second scan-line pass. Reduced-motion mode removes it. Camera permission is requested only after `Open camera`; the sample does not request camera access.
- Photo measurements begin when the scanner appears after onboarding and update on resize, keeping product outlines aligned with the contained photo on phones and wide screens.
- Completion stays under `sugar_scanner_onboarding_v1`; `?onboarding=1` forces the welcome screen. Analytics reports onboarding version `4`, without forcing existing users through onboarding again.
- The compact sheet has a horizontal ranked-card carousel with 56 px packshots plus `Scan again` and `View all`. One full card and about 30% of the next remain visible in portrait; the carousel includes all displayed scan products. A card opens that product; full results show known sugar/protein, optional exact-source Carbs and a separate informational price row. The detail uses a square packshot up to 290 px and a downward chevron back to the list. Fit calculations are unchanged.
- The four demo SKUs have the approved short display names and local packshots. Original catalog identity, product IDs, nutrition, prices and analytics data remain unchanged; other SKUs retain their own source names and images.
- Anonymous feedback supports rating, reason and an optional 300-character comment. The title/close control and submit button remain outside the scrollable content. The dialog tracks the visual viewport as the available screen changes, including keyboard resizing; the success button stays separately accessible. Saving locks the form; retry preserves the answer, and closing returns keyboard focus to the feedback control.
- Accepted anonymous events and feedback use each environment's own Supabase. Amplitude and Resend remain configured only in staging; their staging-only keys are not copied to production. Production funnel events can be checked in Supabase until a separate production analytics setup is approved. Production email notifications are not enabled by this release.

The owner approved publishing this release on 3 September 2026. Future production releases still require explicit approval. Immediate rollback is `production-before-pen-2026-09-03` (`f8b760e`), preserving the latest catalog and ranking. Older fallbacks `production-baseline-2026-08-31` and `scanner-golden-3c83a65` remain available. Apply the additive `supabase/migrations/202608310002_pilot_feedback.sql` to the production Supabase before publishing the feedback UI. Never replace production Supabase credentials with staging credentials.

## Current product behavior

- The scanner follows the approved Pen designs derived from the Sugar.no iOS product screens: a cool light-gray app canvas, large white cards and sheets, subtle neutral separators, near-black typography/controls and system blue reserved for actions and focus. `Great fit`, `Moderate fit` and `Low fit` use text-labelled gradient pills with a white gradient rim.
- The live camera fills the browser content area edge-to-edge behind the white Sugar.no wordmark and dark overlay controls. `Show demo`, `Leave feedback` and the bottom scan status remain inside safe-area insets; the redundant “The scan starts…” caption is removed. Live video and the held frame use centered `object-fit: cover`, so screen proportions may crop the display edges. Capture still sends the complete source frame, and camera outlines use the matching cover projection; fully cropped outlines are omitted while their products remain in the results. Saved photos and demos retain `object-fit: contain` and show the complete image.
- `Reading visible products…` means the browser has selected one stable frame. That captured frame is held on screen while recognition and nutrition enrichment finish, so camera movement cannot detach result boxes from the products that were actually analyzed. A new scene is read only after the user explicitly starts a new scan.
- Before Gemini returns, the browser may show neutral outlined candidate regions derived locally from edge detail. They are only aiming feedback: they never carry a product name, fit color or nutrition claim.
- Camera starts after permission without requiring a shutter action. Mobile Safari requests the rear 1920×1080 feed at up to 30 fps and continuous focus when the device exposes it. The first automatic capture waits at least 1.5 seconds after the video starts, giving the user time to position the phone and the camera time to focus; an explicit `Scan again` keeps the faster restart path.
- Frame-quality sampling starts after 340 ms, checks every 240 ms and sends one compact JPEG up to 960 px wide only after the initial 1.5-second positioning window and as soon as the scene is usable. A further 1.25-second hard capture ceiling prevents the sharpness/stability gate from stalling indefinitely on a soft or low-detail scene. The automatic loop pauses as soon as the frame is submitted, so one Gemini request is used per explicit scan and duplicate center/completion reads are not started.
- When the browser exposes native `BarcodeDetector`, EAN/UPC is resolved locally before Gemini. On Safari, Gemini can still return a visible barcode for the same exact local lookup.
- Live camera, saved shelf photo and checkout photo use the same recognition contract.
- Live and saved-photo views omit the redundant source badge. The live camera keeps `Show demo` and secondary feedback over the feed. Shelf/checkout demos and saved photos have no `Back to live` overlay; use `Scan again` below the results to open the camera. The demo chooser and recovery screen retain their return action. To check, open both demos and confirm the photo is clear of the extra button, then tap `Scan again`.
- `Show demo` and `Leave feedback` share the app's black gradient, 1.5 px white gradient rim, shadow and white rounded semibold labels. Top controls retain a compact 44 px minimum height and use 17/22 px type, reduced to 15/22 px on screens up to 360 px. The feedback control keeps this finish on demo/photo screens too; recovery's Show demo uses the full-size black action. Check both controls on the camera screen, open each, and confirm they stay clear of the logo at narrow widths.
- A scan keeps at most ten distinct, highest-confidence readable products. Repeated facings of one SKU are grouped.
- Rated products are ordered best fit first and use `Great fit`, `Moderate fit`, or `Low fit`.
- Expanded multi-product results use the ranked list as the single comparison view; they do not repeat the leading product in a second `Best fit in this scan` card.
- Expanded multi-product results keep `Best fit first` and the original ranked cards by default. An opt-in `Personal Shelf Rank · Pilot` switch opens the independent category comparison described below; duplicate scan-again controls remain omitted.
- Expanded multi-product results start with the wordmark, collapse control, `Best fit first`, per-100 basis and ranked cards. Tapping a product opens its detail screen. Eligible Better alternatives remain available below the main content. Their horizontal carousel stays inside the content gutters and shows one full card plus about 30% of the next card, with a 12 px gap. Swipe sideways or focus the carousel and use arrow keys; cards snap near their starting edge. Long names wrap, and the last card and its retailer action can be scrolled fully into view.
- Result actions follow the Figma meal-detail button pair: `Scan again` has a blue-to-pale-blue gradient and a white refresh icon on the left; `View all` uses the shared black gradient. Both use the app’s white gradient rim, rounded semibold labels and 56 px minimum height, with a 12 px gap and smaller text on narrow phones.
- Results use short 180–260 ms opacity/transform entrances: the compact sheet rises gently, ranked cards fade in with a capped 30 ms stagger, and opening a product adds a small directional transition. Demo, recovery and feedback surfaces share the same easing; buttons give subtle press feedback. Data updates do not restart screen entrances, camera/media/marker coordinates stay fixed, and navigation remains immediate during motion. The system’s Reduce Motion preference removes these effects as well as loading shimmer/spin. To check: open the sample, tap View all → a product → back, swipe alternatives, and open/close feedback; repeat with Reduce Motion enabled.
- The compact camera preview scrolls horizontally, with one complete card and about 30% of the next visible on the right. Cards share the height needed by their content; a single result fills the available width. Native scrolling, gentle horizontal snapping and left/right keyboard arrows keep every card reachable while `Scan again` and `View all` stay below the scroll area. Names use 15/20 px type, nutrition 13/18 px, and cards retain rank, fit, source-backed sugar labelled `Sugar 2.3 g` and optional Carbs. Sugar text wraps within its column on narrow screens while the number and unit stay together. Short landscape screens keep the existing action-only compact fallback; `View all` opens the full list. To check: open a demo, swipe the compact cards sideways to the last product, open it, return and verify both bottom buttons stay accessible.
- Product thumbnails preserve the source photo proportions. When no exact retailer packshot exists, or a supplied packshot URL fails to load, the card falls back to the matching crop from the submitted scene. The crop keeps a little neighboring shelf context instead of stretching a tight detection box, and a broken-image icon is never left in the result.
- The compact sheet keeps `Scan again` beside `View all`. `Scan again` clears the captured result and starts a fresh live read; expanded comparison does not duplicate that control.
- Uncertain recognition, provider unavailability, camera denial and offline mode have a clear recovery panel. `Not sure — try again` stays coral for uncertain recognition and service unavailability; offline retry uses the primary black button. Both start an explicit retry without changing the automatic request limits.
- Fit camera markers use equal 28 px icon discs with thumbs-up, raised-hand and thumbs-down icons inside colored outlines. They show no floating text pill, including after selecting a product; the fit names remain in result cards and the accessible marker labels. The package outline remains the larger touch target, with a restrained 10% semantic tint. Pending candidates stay neutral.
- The expanded comparison uses one downward-chevron control to return to the camera view.
- Original Sugar.no fit uses verified protein and total sugar per 100 g or 100 ml. Carbohydrates are informational and do not enter that formula. Fiber is not required or displayed in original Fit; the separate Personal Shelf model uses it where supported.
- Nutrition resolution order is: curated catalog, exact Barbora snapshot, strict Rimi/Livin Latvia snapshot, multilingual Livinn Lithuania SKU identity and nutrition snapshot, a previously page-checked shared web card (when enabled), isolated Open Food Facts bulk/API match, then exact Google Search-grounded web discovery.
- Internet enrichment runs after the first identity result and never receives or stores the camera image. Known barcode/catalog identities are enriched first, with up to five independent requests, so one slow unknown product does not hold the rest. A readable barcode or pack size is preferred, but a distinctive brand + product/variant identity may also use the exact fallback when Gemini preserves those details in its search query. Truly brand-only identities still fail fast. The final grounded-search fallback defaults to 12 seconds and is never configured below Google's 10-second minimum.
- With `SHARED_WEB_CATALOG_ENABLED=true`, internet findings become shared cards only after deterministic checks of the actual product page. Repeat exact identities use Supabase before another internet nutrition lookup; aliases and barcode reads work across users/server restarts. The older `web_nutrition_cache` remains available only in the flag-off rollback lane: its AI-only entries are not automatically imported or presented as page-checked shared facts. Misses are retried after six hours; shared cards become due for a non-blocking recheck after 30 days.
- The retired nutrition-label follow-up is removed from the UI and API; automatic exact-source enrichment is the only nutrition path.
- A confidently identified product remains visible while exact nutrition is being checked. An exact Livinn identity without complete nutrition stays as a neutral unrated result; only source-backed protein and total sugar can produce a Sugar.no fit. A shelf price by itself never creates a result card.
- Physical shelf price appears only from a clearly associated high-confidence EUR label.
- Product overlays use Gemini's native `box2d [ymin, xmin, ymax, xmax]` coordinates and exclude shelf labels and neighboring packages from the product box.
- A high-confidence Latvian comma-decimal shelf label can be accepted even when the printed `€` symbol is not readable; numbers printed on a package remain excluded.
- A crossed-out shelf price and full-width black-gradient `Buy cheaper online` action appear in the ranked card only when the exact connected-retailer SKU is currently cheaper. The detail view uses the same `Buy cheaper online` button with both prices inside. No saving or purchase action is invented when shelf price or exact identity is missing.
- Saving buttons use the screenshot layout: `Buy cheaper online` on the left, a 13 px regular crossed-out shelf price and a 17 px bold online price together on the right. Both prices are white inside the existing black-gradient button. Ranked cards, details and eligible alternative cards share this presentation. `Buy online` uses the same rounded semibold label as `Buy cheaper online`: 17/22 px, or 15/22 px on screens up to 360 px wide, without an extra-bold nested label. Without a verified saving, prices remain informational and no cheaper-online action is shown.
- `Better alternatives` are fail-closed and selected from the complete verified nutrition pool: the managed/local Sugar.no catalog, Barbora, Rimi, Livin and the isolated Open Food Facts layer. They must share the same exact product type and form, have `Great fit` that is no worse than the scanned product, and resolve to a current exact offer from a connected retailer. Open Food Facts rows without an exact connected-retailer offer can strengthen recognition and nutrition coverage but cannot become purchasable alternatives. Equal-fit candidates are ordered by lower exact offer price and then the closest known pack size. `Moderate fit`, `Low fit` and unrated products are excluded; if no true substitute is available, the section is hidden.
- Offer lookup is retailer-neutral: exact Barbora, Rimi and Livin offer keys use one API contract. Every displayed price and destination belongs to that exact retailer SKU. The app never compares or labels fuzzy title matches as cheaper. `Buy cheaper online` and a crossed-out shelf price appear only when the exact current online offer is strictly below the observed shelf price; otherwise no saving claim is shown.
- Deterministic Shelf and Checkout demo scenes work without Gemini credentials.
- The demo chooser offers `New rating demo`, Shelf demo, Checkout demo and saved-photo actions without a separate investor-coverage card.

## Personal Shelf Rank — opt-in, bounded evidence

The independent `personal-shelf-v1.1-bounded` model compares sugar, protein, food base and nutrient balance within supported product types. Original Sugar + Protein Fit remains the default; camera overlays, compact results, prices and Better alternatives retain their existing formula. In `View all`, enable `Personal Shelf Rank` to inspect the new comparison; disable it to return to original Fit. Missing ingredients, essential nutrients, unsupported types and contradictory tables remain unscored, not low-scored. This is a preference model, **not a validated health or safety rating**.

The 3 September batch contains **1,248 source observations: 242 complete scores, 716 provisional ranges and 290 unscored records**, including 19 contradictory tables. The 958 assessments are source/SKU records, not globally deduplicated products or recognition accuracy. Of 1,728 supported-category candidates, 104 attempts failed and 376 were left unattempted when Barbora/OFF rate-limited; Rimi/Livinn queues finished. See [verified source accounting and release checks](docs/test-runs/2026-09-03-personal-shelf-batch-rollout.md). No background continuation is running after this batch.

Only absent fiber is optional in chips, crackers, bars and cookies: the UI shows a provisional range, with both endpoints subject to the original nutrient ceilings. Values remain null; weights are not redistributed. Ranges sort by their lower bound. Any overlapping comparison has provisional places, even on a fully documented product; it is not a verified winner. A capped 59–59 interval displays `59/100` with an explicit provisional label. Dairy ignores fiber. Integer-tenths summation fixes half-point rounding; all 64 complete baseline scores were unchanged, and 82 previously fiber-only missing records gained provisional assessments.

Source-backed composition is collected in resumable batches from existing supported-category URLs, not through per-product AI search. Rimi uses source-category breadcrumbs without the product-title slug, so a dip “for chips” is not classified as chips; its exact `sālie cepumi` leaf maps to crackers. The ingredient dictionary now includes Latvian `milti` (flour), a missing alias that had blocked many otherwise interpretable records. Exact SKU and known-GTIN mismatches are rejected, including changed retailer redirects. Original-language ingredients stay intact; the bounded EN/LV/LT/RU/ET rules do not infer nutrition from translated names. Cross-retailer canonical merging is not part of this release.

Use `npm run catalog:sync:shelf-batch` for a read-only request plan. Add `-- --apply` to fetch missing observations from independent rate-limited source queues. Each source has one worker; checkpoints prevent restarting successful work. HTTP 429 stops only that source. Inspect the report before an explicit `--retry-failed`; do not retry before the source's cooling period. `SHELF_BATCH_LIMIT_PER_SOURCE=2` gives a small source-format probe. No job is scheduled automatically and no enrichment crawl runs during a scan.

Retailer observations and OFF observations live in separate generated files and separate private Supabase tables. `npm run catalog:validate:shelf-pilot` reports complete/provisional/unscored counts and checks bounds against complete scores. `/api/health` exposes the shipped evidence counts, not unique-product or visual-recognition coverage. Runtime reads at most ten exact IDs after opt-in, with a bounded local fallback; it never delays the camera, searches the internet or stores a photograph.

Try [New rating demo](https://sugar-no-scanner-demo-production.up.railway.app/demo/personal-shelf), also under `Show demo`. Six exact examples use the same scorer: chips 64/61, a real fiber-missing chip at 57–59, a contradictory chip without a score, and yogurts 97/54. The compact layout is unchanged; tap a card for its ingredients, component points and source. The previous isolated preview is a separate historical deployment and is not updated by this release.

Owner check: compare a complete and provisional card, expand the explanation, confirm the ingredient/number match with the package, then switch back to original Fit. A missing-salt or contradictory product must not look fully rated. Review a real shelf and a translated name/different-flavour pair; automated tests do not establish store-wide recognition accuracy.

Set `PERSONAL_SHELF_RANK_ENABLED=false` and redeploy to hide the switch, demo and evidence endpoint without deleting data or changing original Fit. Model/source details are in [the ranking contract](docs/personal-shelf-rank.md) and [missing-data policy](docs/personal-shelf-missing-data-proposal.md).

- The demo chooser is a light full-screen surface with three white option cards, blue icons and a black primary return action.

## Trust rules

- Recognition confidence and nutrition confidence are separate.
- The app never estimates missing nutrition, converts a serving into per-100 values, or borrows data from another flavor or pack size.
- A possible retailer match cannot drive a price, purchase link, or fit.
- Camera frames are sent to Google Gemini for recognition. Sugar.no does not write them to analytics, logs or Supabase. This processing boundary is documented here and in the privacy contract rather than repeated as persistent camera chrome.
- The investor link opens the scanner directly. Its first same-origin page request receives a 12-hour HTTP-only, same-site session cookie so protected APIs remain unavailable to bare cross-origin calls. Recognition, enrichment, offer and analytics POST endpoints also reject cross-origin browser requests, bound request bodies and apply rate limits. This is request hardening, not viewer access control. The limiter key is a one-way hash of the client address and does not retain the address itself.
- Commercial availability never changes Sugar.no ranking.
- Contradictory exact source tables are quarantined: identities remain available but neither rating can use their nutrition. The guard includes the known Livinn cases `03000011074` and `1AM180309678` and newly collected composition evidence. Missing optional fiber is different: it can receive a clearly provisional Personal Shelf range without inventing fiber or changing original Fit. Source record counts are not globally deduplicated product counts.

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

The standard Mobile Safari suite starts the development server over local HTTP. `E2E_PRODUCTION=1` is not a complete acceptance path on this HTTP harness: Safari does not send production's Secure session cookie, so protected demo APIs return 401. Keep the security flag intact; verify built deployment/session behavior over Railway HTTPS instead.

## API

- `POST /api/recognize`: image data URL plus source type, returns bounded detections.
- `POST /api/barcode`: exact EAN/UPC without an image, resolved against local retailer/OFF layers.
- `POST /api/resolve-products`: up to ten image-free identities, returns optional exact retailer/nutrition enrichment. The client resolves up to five identities concurrently and applies each response independently, so one slow lookup does not hold already verified products. Brand-only identities never start the slow network fallbacks; a distinctive product/variant query can be resolved even when the concise UI label omits its pack details. Exact verified web results persist in Supabase and are served immediately while due rechecks run without blocking (six hours for unverified misses).
- `POST /api/offers`: bounded exact retailer keys for the displayed products and alternatives, returning current Barbora offers plus reproducible exact Rimi/Livin snapshot offers without blocking recognition.
- `POST /api/events`: metadata-only product events with image-like values rejected.
- `POST /api/feedback`: bounded anonymous pilot feedback; comments are optional, limited to 300 characters, and image-like content is rejected.
- `GET /api/health`: service, catalog and deployed commit status.

## Data and Supabase

### Shared page-checked web cards

- Apply `supabase/migrations/202609030001_shared_web_products.sql` through Supabase, then set server-only `SHARED_WEB_CATALOG_ENABLED=true`. It adds three isolated tables and one transactional function; it does not migrate, delete or rewrite existing catalogs/caches. Default off permits a schema-first rollout. Set the flag to `false` and redeploy to disable the new lane without deleting its data.
- `shared_web_products` holds canonical cards; `shared_web_product_aliases` holds exact, proven query identities; `shared_web_product_observations` keeps append-only source observations and conflict decisions. RLS is enabled, browser roles have no direct access, and only the server service role can promote. No public nutrient-write endpoint, image, account ID, location or session is stored.
- Google discovers a page; model-generated nutrient numbers are **not used** in this lane. A direct HTTPS page must have one unambiguous Product identity, a matching brand and pack, and either matching name/variant words or the same checksum-valid source GTIN. Different-language aliases are learned only with this identity evidence. Stable IDs use source host, source GTIN (or URL), brand and pack; different source/market cards are deliberately not globally deduplicated. Ambiguous barcode results are withheld.
- Only explicit per-100 g/ml structured nutrition, labelled two-column tables and supported Livin/Livinn nutrition paragraphs are parsed. Each value must have its own label and unit. Missing, unitless, per-serving, less-than and ambiguous values remain `null`; an explicitly listed zero remains zero. Inconsistent totals are not scored. Source URL, check date and field provenance accompany the record; a confirmed identity can be saved without a score.
- Promotion atomically writes the card, alias and immutable observation. Missing newer values never erase previously checked values. Contradictory new values are quarantined as unknown, not averaged or replaced; they stay blocked until a reviewed correction. A competing identity blocks that alias rather than stealing it. A basis conflict or an inconsistent combined table blocks the nutrition as a whole. A failed or timed-out write leaves enrichment unknown: returning the raw page could otherwise bypass a conflict decision already committed by the database. The recognized visual identity and existing catalog paths remain available.
- Shared cards can be reopened by `web:shared:…` ID and resolved through `/api/barcode`. They are not injected into the broad fuzzy curated matcher or Better alternatives pool: their product category is not yet independently verified. Existing scoring, catalog priority and exact-retailer purchase safeguards are unchanged.
- Default reviewed hosts: Barbora, Rimi Latvia, Livin Latvia and Livinn Lithuania. `SHARED_WEB_SOURCE_HOSTS` can configure exact hosts only after source-permission and parser review. Unsupported page formats remain unknown even when Google finds a page. Open Food Facts is explicitly excluded and stays in its ODbL layer. No bulk crawl/backfill is performed. Fetches have a five-second deadline, a 1.5 MB cap and at most two allowlisted redirects; Supabase operations have a 1.5-second deadline and recognition degrades safely on failure.
- Run `npm test -- src/server/web-product-evidence.test.ts src/server/shared-web-catalog.test.ts src/server/shared-web-catalog-sql.test.ts` for the trust boundary and persistence checks. The SQL migration is executed on an isolated in-memory PostgreSQL engine (PGlite, test dependency only), never on production fixtures.

Owner acceptance after enabling: scan a newly found exact SKU, open its source, then scan the same SKU in a second session/device and confirm the same card/nutrients return. Scan a different size/flavour and confirm it cannot borrow that card. A missing nutrient must stay hidden/unknown; a confirmed product without enough nutrition must remain neutral. Source-format coverage is intentionally conservative and real-store performance still needs owner testing.

Technical and migration evidence: [shared web catalog checks](docs/test-runs/2026-09-03-shared-web-catalog.md).

Checked-in generated snapshots make the investor demo reproducible and fast:

- `data/catalog.generated.json`: curated comparison catalog.
- `data/barbora-product-index.generated.json`: broad checked-in retailer identity index used for recognition lookup only; it is not imported into the operational Supabase catalog.
- `data/barbora-food-product-index.generated.json`: checked-in food discovery subset used for local matching only; it is not imported into the operational Supabase catalog.
- `data/barbora-nutrition-index.generated.json`: the operational source-backed Barbora nutrition snapshot with exactly 7,433 exact SKUs containing both protein and total sugar.
- `data/rimi-catalog.generated.json`: exact Rimi product-page bootstrap snapshot.
- `data/livin-catalog.generated.json`: exact Livin product-page bootstrap snapshot.
- `data/livinn-food-index.generated.json`: 2,489 edible identities from the complete 5,926-URL canonical Livinn Lithuania product sitemap, including exact SKU/GTIN and source-provided Lithuanian, Latvian, Russian and Estonian aliases. Identity-only rows cannot receive a fit.
- `data/livinn-catalog.generated.json`: 1,855 raw Livinn Lithuania nutrition tables with energy, protein and total sugar per 100 g or 100 ml. Two known contradictory tables are quarantined; 1,853 remain eligible for Fit.
- `data/rimi-catalog-sync-report.generated.json`, `data/livin-catalog-sync-report.generated.json` and `data/livinn-catalog-sync-report.generated.json`: complete configured-scope accounting.
- `data/open-food-facts-lv.generated.json`: attributed Latvia subset imported through the ODbL pipeline. Source-provided `product_name_*` values are retained as multilingual identity aliases rather than translated or discarded.
- `data/open-food-facts-regional.generated.json`: optional licensed Lithuania/Belarus OFF bulk layer. It stays empty until the official multi-gigabyte export is run as an approved durable data job.
- `data/catalog-sources.generated.json`: source, license and redistribution manifest.
- `data/personal-shelf-evidence.generated.json`: exact Barbora, Rimi and Livinn ingredient/salt/saturated-fat/fiber observations from the resumable supported-category batch. Missing values are null; QA fixtures are not included.
- `data/personal-shelf-off-evidence.generated.json`: separate ODbL composition observations obtained by exact barcode, never mixed into the retailer file.

Regeneration and validation scripts live in `scripts/`. Supabase migrations and seed tooling live in `supabase/`. Do not hand-edit generated JSON. Rimi/Livin/Livinn snapshots are for the private proof of concept; production reuse and recurring ingestion require retailer permission. Open Food Facts rows stay logically and physically separate because of ODbL obligations. See [catalog sources](docs/catalog-sources.md).

Apply all migrations through `supabase/migrations/202609020001_livinn_multilingual_catalog.sql` before seeding. The carbohydrate migration is nullable and additive; it does not rewrite existing nutrition or recalculate Sugar.no fit. The multilingual migrations add only source-backed aliases and search indexes. Livinn food identities live separately from nutrition-complete rows, so missing nutrients remain missing instead of becoming zero or an estimated fit. Existing snapshots created before these migrations continue to work and omit newly supported fields until their next source refresh. The RLS-protected current tables retain verified exact-SKU nutrition permanently; `revalidate_after` is a freshness deadline, never a deletion date. Web sources are due after 30 days, retailer nutrition after 90 days, manufacturer or label evidence after 180 days, and prices after 24 hours. Append-only version tables preserve verified history, and a failed refresh cannot overwrite a previous success. The operational Barbora table is pruned to exactly the 7,433 nutrition-complete SKUs during `npm run supabase:seed:external`; the wider Livinn edible identity index is seeded into its dedicated table and pruned to the checked-in snapshot. No table stores camera images.

Use `npm run supabase:seed:external:dry-run` to verify the checked-in Barbora snapshot without writing data, `npm run supabase:seed:external` to reproduce the managed import, and `npm run supabase:verify:external` to assert that Supabase contains exactly 7,433 current and nutrition-complete Barbora rows plus their immutable versions.

Run `npm run catalog:preload:nutrition` to inspect the Latvia demo list, then add `-- --apply` with server credentials to warm exact web results. An unverified miss is cached for six hours only; this avoids repeated searches without inventing values.

Connected-retailer resolution runs before Open Food Facts and grounded web lookup. The Rimi matcher normalizes a small audited set of English package labels to their Latvian catalog identity while still requiring the same brand, pack size and an unambiguous top candidate. Livinn keeps source-provided alternate-language URL names under one SKU and GTIN; an English, Russian, Latvian or Lithuanian read can therefore supply the same canonical identity to later nutrition lookup. Open Food Facts evaluates every source-provided product-name language for the same GTIN. Both growing catalogs are indexed by brand/barcode, so multilingual matching does not scan every row. A language alias never bypasses brand, variant, pack-size, nutrition-completeness or ambiguity checks.

The managed `products` table is optional in this proof of concept. If it has not been migrated and seeded, or is empty, product recognition and barcode lookup continue from the checked-in scored catalog while `web_nutrition_cache` still uses Supabase independently.

For Personal Shelf Rank, additionally apply `supabase/migrations/202609030002_personal_shelf_evidence.sql` and review `npm run supabase:seed:shelf-pilot` (dry-run). With the approved Supabase target and server credentials, `npm run supabase:seed:shelf-pilot -- --apply` uses the server-only atomic RPC to upsert whole observations only when newer, then verifies every field on readback. It never deletes rows or joins nutrient fields from different sources. The optional `/api/personal-shelf` reads at most ten exact IDs only when the pilot opens; absent/offline/unseeded Supabase falls back to local observations within a two-second read deadline. It does not scrape, store images or delay recognition. Deployment evidence is recorded in the dated rollout log.

## Railway release

For the Livinn-only release, apply the additive multilingual migrations through `202609020001_livinn_multilingual_catalog.sql` in the approved Supabase project. Run `npm run supabase:seed:livinn` for a dry run, then `npm run supabase:seed:livinn -- --apply` with server-only credentials. This scoped import upserts only the Livinn source, 2,489 identities, 1,853 eligible nutrition records and their immutable versions; it never prunes data or rewrites Barbora, Rimi, Livin Latvia, Open Food Facts or web caches. Quarantined raw observations remain in the versioned local snapshot, not in the verified Supabase nutrition layer.

Release checks and owner acceptance: [Livinn production release](docs/test-runs/2026-09-03-livinn-production-release.md).
### Production release

The approved Pen release uses GitHub `main` and the existing Railway production service. Save `production-before-pen-2026-09-03` on `f8b760e` before publishing. The production base tables were absent, so apply `202608200001_scanner_demo.sql` followed by `202608310002_pilot_feedback.sql`, together in a transaction, before this release. These create private tables without deleting or seeding any catalog records. Keep production credentials and feature flags unchanged. Push the reviewed release to `main`, set `COMMIT_SHA` to that pushed revision and upload the same clean checkout with explicit `--environment production --service sugar-no-scanner-demo --project 9e2a4887-0e19-4ca7-ae99-d68816542558`. Wait for SUCCESS and verify live health, sample results, rating-demo access, event storage and feedback readback over HTTPS. Staging and the historical rating preview remain separate.

### Staging feedback email notifications

After `pilot_feedback` is saved, a Next.js `after()` callback sends a plain-text email through Resend. It includes the rating, reason, optional comment, screen context, UTC timestamp and feedback ID, but no session identifier, photos, OCR, or browser fingerprint. Recipients and sender are server configuration only; user input cannot change them. Amplitude still never receives the comment.

Set `FEEDBACK_EMAIL_ENABLED=true`, `RESEND_API_KEY`, `FEEDBACK_EMAIL_FROM` (a bare address on the verified domain) and `FEEDBACK_EMAIL_TO` (one owner address) in Railway staging. Sending is also gated by `RAILWAY_ENVIRONMENT_NAME=staging`; it remains disabled in production even if the flag/key is copied. Use a dedicated sending-only key restricted to the verified sender domain. To disable notifications without affecting feedback storage, set `FEEDBACK_EMAIL_ENABLED=false` and deploy staging.

The approved setup uses `scanner@marketing.intend.com` to notify `anastasiia@sugar.no`, with a separate key and the existing Resend account's shared quota. No paid plan or pay-as-you-go is required or enabled by this integration. There are two bounded attempts for transient failures using the same [Resend idempotency key](https://resend.com/docs/dashboard/emails/idempotency-keys). A notification failure never changes the successful feedback response. Delivery is best-effort, not a durable queue: crashes or quota exhaustion can prevent an email; the saved feedback remains in Supabase. Metadata-only `feedback_email` logs record success/failure and the feedback ID; `sent` means accepted by Resend, not confirmed inbox delivery.

Check: submit a clearly labelled test feedback in staging, confirm its success state and Supabase row, then confirm the matching email in the owner's mailbox or a `Delivered` event in Resend. Test invalid inputs and mail failures with `npx vitest run src/server/feedback-email.test.ts src/app/api/feedback/route.test.ts`; local/E2E environments must not load real mail credentials.

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

1. Open [production with welcome forced](https://sugar-no-scanner-demo-production.up.railway.app/?onboarding=1) in iPhone Safari. Compare welcome typography, fit-chip rims and black buttons to Pen. Try a small phone and landscape.
2. Choose `Try a sample shelf` → `View all` → `Salty Peanut`. Confirm the four ranked products, source nutrition, crossed-out €3.49 / €2.79 example, `Buy cheaper online` with the old and lower prices inside the button, and return to the list. The retailer action opens a new tab.
3. Open the live camera: the image should fill the browser content area, with a white logo and dark controls over it, no pale header strip and no “The scan starts…” line. Rotate the phone and check that controls remain clear and product outlines follow the held frame. Then choose Checkout demo or a saved photo. Confirm the whole image is shown, package outlines follow the image, and unknown nutrition remains neutral. Test live recognition on the phone with an actual shelf; automated camera tests do not replace a real-store accuracy check.
4. Open `Leave feedback`. Check Needs work, reason, optional comment, success and closing. Keyboard users can stay inside the dialog and return to the trigger. A failed send preserves the answer for retry.
5. Deny camera permission or disconnect the network and confirm a useful recovery action. Photos must not appear in analytics or persistence.

Technical validation uses `npm run verify` and the Mobile Safari suite (`CI=1 E2E_PORT=3012 npm run test:e2e`). `E2E_PORT` defaults to 3000 and lets an isolated checkout avoid another project's running server. The focused `npm run test:e2e -- pen-iphone-layout` check covers 320×568, 375×667, 390×844, 402×874, 440×956, 667×375 and 874×402, plus feedback with only 390×360 available. It checks unobstructed controls, card containment, horizontal overflow and accessible scrolling. These are WebKit Mobile Safari emulations; physical iPhone keyboard, browser chrome and camera behavior still need an on-device check. Screenshots are stored under ignored `test-results/`; browser tests mock external failures and feedback writes. Production-build API/session smoke runs on staging HTTPS; Mobile Safari does not send the production Secure cookie to a local HTTP origin.

## Known limits

- Latvia-wide nutrition coverage is not guaranteed. Private labels, unreadable variants and products without an exact public per-100 table can remain as clearly unrated visual identities in the comparison. They never receive an invented fit or retailer claim; anonymous price-only findings stay hidden.
- Real shelf, glare, low-light, moving-belt and price-label accuracy still require a physical store benchmark.
- Barbora, Rimi and Livin Latvia can produce exact offers for their own matched SKUs. The checked-in Rimi layer contains 6,822 complete products after checking all 7,617 pages in the seven approved food and drink categories. Livin Latvia contributes 6 complete rows after checking its full 169-URL sitemap. Livinn Lithuania contributes 2,489 edible identities after accounting for all 5,926 canonical product URLs; 1,853 have eligible Fit nutrition and 636 remain explicitly unrated (634 incomplete plus two quarantined tables). Lithuanian offers are not presented as Latvia purchase actions. These snapshots are not a market-wide real-time price engine.
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
