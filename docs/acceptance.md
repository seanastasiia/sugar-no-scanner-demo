# Acceptance matrix

Status reflects reproducible evidence in this repository, not the intended final result.

| Criterion | Current evidence | Status |
| --- | --- | --- |
| Public camera-first entry | Proxy unit test allows `/`, recognition and product APIs without a session; `/access` redirects to `/`; browser regression asserts that no code field or `Private demo` copy remains | Pass locally |
| Official Sugar.no header brand | Scanner header uses the exact white symbol-and-wordmark SVG published on `sugar.no`, keeps its source aspect ratio, provides `alt="Sugar.no"` and makes no runtime request to the website or Framer CDN | Pass locally |
| 40 Latvia SKUs | Generated catalog validation and unit test | Pass |
| Broad Barbora discovery | Reproducible public-sitemap index contains 18,554 unique product slugs | Pass as discovery index |
| Active food source coverage | 9,707 active non-adult food SKUs; 7,433 exact pages (76.57%) have energy, protein and total sugar | Pass as catalog-data coverage, not visual accuracy |
| On-demand Barbora nutrition | An exact food SKU is fetched after recognition; unit tests require source-backed energy, protein and total sugar for the two-factor fit. Protein-only, sugar-only and identity-only states remain neutral | Pass locally |
| Exact Open Food Facts fallback | A visible barcode uses the official product-by-code API; strict text fallback requires matching brand, variant and pack size. Wrong Coke variant and wrong pack-size regressions fail closed | Unit pass; live barcode check pass |
| Nutrition-label recovery | An unrated package exposes one `Scan nutrition label` action. The follow-up API requires the selected identity and accepts only a high-confidence per-100 table with adjacent OCR evidence for kcal, protein and sugars; the Mobile Safari journey ends in a source-labelled fit | Pass locally |
| Product outside scored catalog | Generic identity is implemented; the Sanpellegrino screenshot resolves to an exact Barbora page while non-exact candidates remain unlinked | Pass as concept |
| Camera occupies the primary viewport area | The scanner is constrained to all four live viewport edges so WebKit cannot retain a stale `100dvh` after resize/orientation changes; the compact result sheet overlays only the bottom edge | Pass locally |
| Result sheet expands into a page | Recognition opens a compact 158 px phone sheet with product thumbnails; an explicit control expands it between `top: 0` and `bottom: 0`, hides background controls from focus and collapses back to camera | Pass locally |
| iPhone responsive matrix | Mobile Safari keeps the camera, compact actions, status and expanded dialog inside 402×874 iPhone 17 Pro portrait, 874×402 landscape, 440×956 large portrait and 375×667 small portrait viewports; only explicit product rails scroll horizontally | Pass locally |
| Landscape saved shelf photo | One full-frame read plus three overlapping row close-ups are merged into original-photo coordinates. Source-backed exact SKUs replace overlapping broad generic identities; portrait/focused uploads remain single-pass. Latvian inflections and `4x80g` versus `3+1 / 320g` are covered without relaxing the exact-SKU/packshot gate | Logic and Mobile Safari pass; two reported production photos pending release check |
| Multi-product fit order | The expanded dialog renders a vertical best-first list. Complete Protein/Sugar fits sort from higher to lower score with visible fit text and values; identity-only or incomplete items remain stable at the end as `Needs nutrition label` without a rank. The four-item shelf and three-item checkout fixtures encode both states | Pass locally; production recheck pending |
| Uncertain broad frame gets a focused retry | Mobile Safari regression returns `not_sure` for the broad pass, verifies the automatic `focusMode=true` request, remaps its box and then holds the matched result; threshold unit tests cover broad 0.72 versus focused 0.58 | Pass locally |
| Several products from one live shelf frame | Broad recognition scans the complete frame and returns up to eight distinct readable front-facing SKUs; unit coverage verifies the prompt and that retailer resolution reaches identities seven and eight with bounded concurrency. The browser regression is written for a provisional one-item result followed by a fuller shelf result | Logic pass; current browser and real-shelf runs pending |
| Repeated facings count once | Server and client normalize same-SKU detections; unit test merges four Coca-Cola descriptions and live-camera WebKit test renders one unique product | Pass locally |
| Live result remains readable | Successful camera recognition pauses the frame and requests until `Scan again`; WebKit test confirms no background replacement and then a clean new result | Pass locally |
| Conflicting retailer brand | Coca-Cola/Pepsi brand regression is rejected before any offer is returned; possible matches have no UI link | Pass locally |
| Price requires shelf label | Unit regression requires a separate-label signal, confidence ≥0.90 and matching EUR text; browser regression confirms no price module without that evidence and no retailer link for a non-exact SKU | Pass locally |
| Camera focuses on Sugar.no ratings | Complete protein-plus-sugar fits use `Great / Moderate / Low` markers. One-factor and identity-only detections remain available in the result sheet but never receive a camera marker, overall fit or misleading approval icon | Pass locally |
| Camera overlay stays visually focused | Rated markers show the fit icon and selected fit label without a redundant `2/2 signals` pill. Selected and best packages keep their fit-colored outline and never add a white frame | Pass locally |
| Unrated result is actionable | The expanded result omits the repeated fit legend, labels the row `Needs nutrition label` and provides one 48 px primary recovery action rather than a passive `Identified` state | Pass locally |
| Best-in-scan hierarchy | The label appears as an eyebrow heading above the product name only for two or more results with the same rating basis; a one-product regression proves it stays absent | Pass locally |
| Nutrition never invented by AI | Main recognition hydrates curated, exact Barbora or exact Open Food Facts nutrition. Label mode may transcribe one visible per-100 table, but server-side OCR consistency, basis, confidence and plausibility checks reject ambiguous values | Pass |
| Badge calculation and missing-data rule | Unit tests cover the equal protein/inverse-sugar formula, fiber independence, category percentiles, EU-reference bands, solid/liquid sugar thresholds, one-factor neutrality, zero-factor identity, adult pages and no-data pages | Pass |
| Exact Barbora link and current price | Live page parser, brand guard, candidate-margin tests and UI end-to-end assertions allow only an exact SKU to drive the `Cheaper at Barbora` action or crossed-out shelf price | Pass locally |
| Shelf demo | One photorealistic concept image returns four deterministic detections with compact icon markers and a collapsed thumbnail sheet; the legend and product comparison appear on expansion | Pass as concept |
| Checkout demo | One real checkout-belt photo returns the three packaged identities Gemini could read (Sproud, Schnitzer and Stockmann) in the expandable sheet; all remain unrated and off the camera overlay until nutrition is verified | Pass as interaction fixture |
| Shelf/checkout navigation | `Show demo` opens shelf, checkout and saved-photo choices; every demo has a clear return to live camera | Pass locally |
| No save actions | Product, checkout and Similar options results expose comparison and retailer actions without Save buttons or a persisted product list | Pass locally |
| Repeated-frame de-duplication | Unit tests retain one tray entry per SKU across repeated live-camera detections | Pass as logic |
| Raw images not stored in analytics | `imageStored: false`, metadata guard and API end-to-end rejection test | Pass at app boundary |
| Permission denied | Mocked WebKit browser scenario verifies explanation, retry and continued access to `Show demo` | Pass locally |
| Saved-image fallback | Client resize and provider-unavailable state tested | Pass locally |
| Shelf-price comparison | UI regression proves a trusted €1.69 shelf price appears beneath the recognized product and is crossed out only for an exact €0.99 Barbora match | Pass as logic |
| One-tap cheaper purchase | A trusted cheaper exact SKU exposes a 44 px or larger `Buy cheaper` link in the compact camera sheet; possible matches and frames without a shelf label expose no purchase action | Pass locally |
| Live shelf-label OCR | Real Gemini call on the concept shelf identified six distinct front-facing products and associated €1.79/€2.29 labels in 7,159 ms; physical Latvia benchmark is absent | Partially measured |
| Live recognition rate limit | Default 36/60 allowance covers the roughly 29/min camera cadence; samples are exempt and API `429` includes `Retry-After`. Client code pauses capture, preserves a provisional product and exposes retry/demo actions; unit and browser regressions encode the contract | Pass locally |
| Production build | `next build` succeeds and standalone assets are prepared | Pass locally |
| Focus top-1 ≥ 90% on 10 real packshots | Gemini is configured and one production concept-image call succeeds; the 10-packshot benchmark has not been run | Not measured |
| Shelf recall ≥ 75% on real/golden images | Deterministic demo is not an accuracy benchmark | Not measured |
| Checkout recall ≥ 80%, duplicates ≤ 5% on a real belt | Dedup logic passes; real photo/video vision benchmark absent | Partially measured |
| Unsupported false-positive rate ≤ 5% | Closed-catalog fail-closed behavior exists; real negative set absent | Not measured |
| Cached result < 1 s | Deterministic/API flow observed in WebKit | Pass locally |
| New AI p95 < 4 s | One current broad-identity plus live-retailer call took 3,591 ms on the supplied Sanpellegrino screenshot; a p95 sample has not been collected, and the six-product shelf took 7,159 ms | Not measured |
| Supabase migration, seed and writes | Migration and seed are reproducible | Prepared, not applied |
| Railway HTTPS and live health check | GitHub Actions run 32781804241 passed for commit `c69e87e72b936fce7e968936abddd05f586a22bb`; Railway `/api/health` reported the same commit. Public UI smoke showed three actionable checkout pending rows, and an exact-barcode product API smoke returned a complete Open Food Facts-backed fit | Pass in production |
| Physical iPhone Safari shelf test | Requires deployed HTTPS and physical products | Not run |

The deterministic scenes prove the interaction and data contract. They must not be presented as evidence of real-world computer-vision accuracy. The independent QA record and the suitability-only review of temporary Latvian-store images are in [the 2026-08-24 QA run](test-runs/2026-08-24-independent-qa.md).
