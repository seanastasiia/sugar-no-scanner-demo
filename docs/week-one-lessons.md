# Sugar.no Live Scanner: week-one lessons and guardrails

This is the condensed engineering and product knowledge gained while building and repeatedly testing the Latvia proof of concept. Read it before changing recognition, catalog matching, camera state, ratings, pricing or the investor demo.

`Bugs.md` remains the chronological defect log. This document translates those defects into reusable team rules.

## The five different truths

The most important lesson is that the scanner does not have one confidence level. It has five separate truths:

1. **Visible identity:** Gemini can read a brand or package name.
2. **Exact SKU:** brand, variant, flavor and pack size resolve to one catalog record.
3. **Verified nutrition:** protein and total sugar come from one trusted source on a consistent per-100 basis.
4. **Sugar.no fit:** both required nutrition signals exist and can be evaluated with the correct rating basis.
5. **Current retailer offer:** an exact live product page currently returns a price and availability.

Never collapse these states. A confident visual identity may still have no exact SKU, nutrition, fit or retailer action. Each UI claim must be backed by its own evidence.

## Non-negotiable product rules

- Gemini may read packaging, boxes, barcodes and tightly gated shelf-label text. It may not invent nutrition, an exact retailer SKU, a price or a fit.
- A product without both verified protein and total sugar remains neutral and receives no overall fit marker.
- `Great fit`, `Moderate fit` and `Low fit` are the only user-facing fit states. The internal numeric score is for deterministic ordering, not display.
- Camera overlays appear only on products with a complete fit. Identity-only products remain in the result list as `Needs nutrition label`.
- Repeated facings of one SKU count as one product, not several recognition successes.
- A retailer link or crossed price requires an exact SKU. A possible candidate never reaches the UI.
- `Cheaper at Barbora` requires a trusted physical shelf price and a lower current exact Barbora offer.
- Barbora is the only connected retailer. Never call its offer the `best price`.
- Recognition results are held while the user reads. They change only after `Scan again` or an explicit source change.
- Raw camera and uploaded images remain transient and never enter analytics or persistent storage.

## Recognition and catalog lessons

### 1. Visual recognition is not nutrition coverage

**What failed:** Packages were called `Identified`, but most had no useful Sugar.no result.

**Guardrail:** Hydrate nutrition only from the curated benchmark, an exact checked-in Barbora record, an exact/strict Open Food Facts record, or the explicit nutrition-label recovery flow. If all fail, say `Needs nutrition label` and provide the recovery action.

**Regression:** Identity-only, one-signal and complete-fit results must all render different states without crashes or approval markers.

### 2. A large sitemap is not a rated catalog

**What failed:** The raw 19,076-page count and the 40 curated products were both mistaken for Latvia-wide coverage.

**Guardrail:** Report discovery, active-food, nutrition-complete and measured visual-recognition coverage separately. The current health endpoint is authoritative for deployed catalog counts. The 40 products are a deterministic protein-snack comparison cohort, not the scanner ceiling.

**Regression:** `catalog:validate:barbora-coverage` must pass, and external claims must use the active-food and complete-nutrition denominators rather than the sitemap total.

### 3. Generic token matching is dangerous

**What failed:** Coca-Cola could open Pepsi; `Selga Classic` could tie several flavors and product lines; promotional sizes could resolve to the wrong pack.

**Guardrail:** Exact resolution must consider brand or visible sub-brand, distinctive variant/flavor words, product-line conflicts, pack or multipack size and the margin over the runner-up. A conflicting brand is an immediate rejection.

**Regression:** Maintain wrong-brand, wrong-variant, wrong-size and close-candidate negative tests whenever matcher weights change.

### 4. AI confirmation must be constrained

**What failed:** Letting the provider choose from a large product enum exceeded the Gemini structured-output limit and would have allowed false certainty.

**Guardrail:** The main model returns a compact visible identity. When two or three exact local candidates remain, the second visual pass may choose only from those IDs and packshots. Accept it only above the documented high-confidence threshold; reject every other ID.

**Regression:** Provider schema tests must assert the compact contract, candidate bounds and rejection of invented IDs.

### 5. Category hints improve speed but cannot become hard filters

**What failed:** A wrong coarse aisle category could hide the correct product even when it existed in the broad snapshot.

**Guardrail:** Search the smaller supported snack/dairy pack first, then fall back to the broad index. Category is a ranking hint, not proof.

**Regression:** A deliberately wrong category must still resolve an otherwise exact SKU through the broad fallback.

### 6. Fiber was the wrong completeness requirement

**What failed:** Latvian retailer records often omitted fiber, leaving otherwise useful products unrated.

**Guardrail:** The current fit uses protein and total sugar only. Fiber may remain in raw data but must not affect completeness, UI or ranking unless a future product decision explicitly changes the model and migrates every test and claim.

**Regression:** Missing fiber with complete energy/protein/sugar must still produce a fit; missing protein or sugar must not.

### 7. Comparison cohorts must be fair

**What failed:** Incomplete or differently based results entered fair-comparison logic; one null rating basis could crash rendering.

**Guardrail:** `Best fit in this scan` requires at least two products with the same category/reference basis, per-100 basis, scoring method and both signals. Near ties have no winner. Unrated products are listed after rated products without a rank.

**Regression:** Cover one-product, mixed-basis, incomplete, near-tie and null-rating-basis cases.

## Camera and multi-product lessons

### 8. Shelf recognition must start broad

**What failed:** A center-biased prompt returned one package from a shelf that contained several useful choices.

**Guardrail:** The first pass scans the complete frame left-to-right and top-to-bottom and returns up to eight distinct readable front-facing SKUs. The focused center crop is a fallback only after an uncertain broad pass.

**Regression:** A live-camera browser scenario must retain several distinct products from one frame; the focused retry has a separate threshold and box-remapping test.

### 9. Detections are not products

**What failed:** Four Coca-Cola cans became four products; multiple frame attempts accumulated duplicates.

**Guardrail:** De-duplicate by verified catalog ID, exact retailer SKU or normalized brand/product identity, then merge boxes. Keep scan-session boundaries explicit.

**Regression:** Four facings of one SKU must yield one product, while two variants from one brand must remain separate.

### 10. Do not update a result while it is being read

**What failed:** Moving the phone replaced or accumulated results before the user could read them.

**Guardrail:** Freeze the successful frame and result. `Scan again` clears it and begins a new session. Do not merge detections from different moments into one shelf.

**Regression:** Hold a result through additional mocked frames, then prove `Scan again` replaces it cleanly.

### 11. Source changes must cancel stale work

**What failed:** Opening Checkout during a camera request left a preloader, and the late camera response overwrote the deterministic demo.

**Guardrail:** Switching between Camera, Shelf, Checkout and Upload must abort the active request, clear its in-flight slot and ignore late completions through a request/source generation guard.

**Regression:** Delay a live response, switch source and prove that the new scene persists after the delayed response arrives.

### 12. One in-flight request is necessary but not sufficient

**What failed:** Camera cadence exceeded the server allowance, `429` responses retried forever and provider outages kept spending requests.

**Guardrail:** Allow one image request at a time. On `429`, respect `Retry-After`, pause capture and preserve any provisional result. On provider unavailability, stop automatically and expose an explicit retry/demo path.

**Regression:** Rate-limit and provider-unavailable browser tests must assert that request counts stop increasing.

### 13. First useful result and full enrichment are different latency targets

**What failed:** The camera waited for Barbora, Open Food Facts and sometimes a second Gemini comparison before showing a recognized package.

**Guardrail:** Return the primary Gemini identity plus local snapshot matches first. Run retailer/OFF enrichment through the image-free resolver after the held result is visible. Abort enrichment on `Scan again` or source change.

**Regression:** Keep enrichment deliberately blocked and prove identities still appear within the browser acceptance budget.

### 14. Do not lower image detail without evidence

**What failed:** Lower Gemini media resolution was assumed to be faster, but the same-image production trial showed no consistent gain and risked package-text accuracy.

**Guardrail:** Change image size/detail only through a benchmark that measures latency, identity recall and exact-SKU precision together.

**Regression:** Record before/after provider timing and ground-truthed recognition results, not one anecdotal scan.

### 15. Preserve a valid provisional result

**What failed:** An uncertain shelf-completion pass erased a useful first product.

**Guardrail:** A valid provisional identity survives an uncertain completion attempt. Additional passes may enrich or add products, but uncertainty cannot downgrade an already accepted result without contradictory evidence.

**Regression:** First pass returns one valid item, completion returns `not_sure`, final UI still holds the original item.

## Saved-image lessons

### 16. Wide shelves and long screenshots need different tiling

**What failed:** One downscaled pass lost readable rows in landscape shelves and product cards in tall online-store screenshots.

**Guardrail:** Analyze dense landscape images as full frame plus overlapping row sections. Analyze long portrait screenshots as full image plus overlapping vertical sections. Remap boxes to the original image and de-duplicate across passes.

**Regression:** Verify the number of provider calls, coordinate remapping, overlap de-duplication and final unique products for both orientations.

### 17. Screen content is not a physical shelf

**What failed:** Camera-style white corners implied an upload crop, and an online-store page could confuse an online price with a physical shelf label.

**Guardrail:** Saved images have no decorative crop guide. The prompt must explicitly allow supermarket shelves, checkout scenes and online-grocery pages. Prices printed inside an online page can never become physical shelf prices.

**Regression:** A retailer-page screenshot can yield several product identities but no shelf-price comparison.

### 18. Bound image payloads before the API

**What failed:** Native iPhone photos could exceed the request body limit.

**Guardrail:** Resize and JPEG-compress uploads in the browser before transmission. Preserve enough resolution for package text and enforce both encoded-data and JSON body limits server-side.

**Regression:** Cover oversized source images, supported formats and fail-closed provider-unavailable behavior.

## Nutrition and fit lessons

### 19. Nutrition transcription is a recovery flow, not silent AI completion

**What failed:** Identification without catalog nutrition was a dead end; auto-filling missing values would have been unsafe.

**Guardrail:** Ask the user to turn the pack around and deliberately scan one nutrition table. Accept only a clear per-100 basis with matching OCR evidence, confidence and plausibility checks. Replace only the selected pending product.

**Regression:** Test per-serving rejection, implausible values, low confidence, missing OCR support and preservation of other shelf results.

### 20. Nutrition and live price must be independent

**What failed:** An exact source-backed fit disappeared when the current Barbora product page timed out.

**Guardrail:** The versioned exact nutrition snapshot may keep the fit. Hide only the live price, availability and retailer CTA when the current page fails.

**Regression:** Exact local nutrition plus failed retailer fetch must remain rated and show no stale price.

### 21. UI language must match the main Sugar.no product

**What failed:** `Top fit / Mixed / Trade-offs`, an unexplained numeric score and gray information markers created a second rating system.

**Guardrail:** Use one shared presentation mapping for `Great fit / Moderate fit / Low fit`. Keep verified Protein and Sugar values in details. Never use `bad`, `unhealthy` or food-shaming language.

**Regression:** Search visible and accessible copy in browser tests; do not test only color or icons.

## Price and retailer lessons

### 22. Shelf-price OCR requires spatial evidence

**What failed:** A price module appeared without a visible shelf label; pack sizes, deposits or online values could look like prices.

**Guardrail:** Require a separate physical-label signal, confidence of at least 0.90, matching EUR OCR text and association with the correct product box. Ambiguity hides the price.

**Regression:** Cover no-label, deposit, pack-size, multiple-nearby-label and correct-label cases.

### 23. Only exact retailer matches are actionable

**What failed:** A visual Coca-Cola identity opened a Pepsi page, and weak text candidates risked price claims.

**Guardrail:** Possible matches remain server-internal. Only exact brand/variant/size evidence can drive a retailer link, current price or crossed-price claim.

**Regression:** Every positive price/link test needs a paired conflicting-brand or wrong-pack negative test.

### 24. Do not cache certainty

**What failed:** The first cache stored query-specific match confidence by retailer slug, allowing one scan's confidence to leak into another.

**Guardrail:** Cache only the parsed retailer payload. Recalculate identity confidence and exactness for every photographed package.

**Regression:** Two queries for the same retailer slug with different package evidence must produce independent match decisions.

### 25. Demo commerce needs transparent fixtures

**What failed:** The investor demo promised crossed-price savings but had no reproducible price evidence.

**Guardrail:** Deterministic demo prices must be labelled as demo shelf values, paired with an exact dated retailer page and never presented as a live store observation. Live camera keeps the stricter OCR gates.

**Regression:** Demo and live-camera price paths must be separate test fixtures.

## UX and design lessons

### 26. The camera must remain the primary surface

**What failed:** Product details pushed the scene away, weakening the entire shelf-comparison concept.

**Guardrail:** Keep the scanner full-viewport with a compact bottom sheet. Expand deliberately into a full, internally scrollable comparison page and allow a clear return to the held scene.

**Regression:** Check initial camera visibility and sheet behavior at every supported phone viewport.

### 27. Put comparison in the list, not in explanatory chrome

**What failed:** Users saw unordered horizontal cards, repeated legends, signal explanations and duplicated instructions.

**Guardrail:** Use one best-fit-first vertical list for full comparison. Keep the fit attached to each product. Remove repeated legends, generic source accordions and explanations that do not change the next action.

**Regression:** Confirm the first rated row is the highest fit and unresolved products follow without rank.

### 28. Camera markers must be compact and semantic

**What failed:** Large labels covered products, gray `i` markers looked like broken checks, `2/2 signals` repeated detail and a white selected ring obscured packaging.

**Guardrail:** Use one fit-colored outline and compact icon. Expand text only where it remains legible. Put detailed Protein/Sugar evidence in the sheet, not on every package.

**Regression:** Narrow product boxes must not overflow or collide; identity-only products receive no camera marker.

### 29. `Best fit` is a comparison heading, not another badge

**What failed:** One product was called best; later the label competed visually with the actual Sugar.no fit.

**Guardrail:** Show it only above the leading product name when at least two fair-cohort products exist. It is an eyebrow heading, not a status pill.

**Regression:** One-product and mixed-basis scans show no winner.

### 30. Every visible action needs a real product purpose

**What failed:** Save controls, private-demo chrome, duplicate arrows and hidden retailer actions distracted from recognition and comparison.

**Guardrail:** The primary journey is scan, compare, understand and optionally buy a proven-cheaper exact item. Remove actions without an immediate supported outcome. Keep one collapse arrow and one clear `Scan again` action.

**Regression:** Browser copy checks must prove removed controls do not reappear in compact, expanded, checkout or Similar options surfaces.

### 31. Use first-party brand assets

**What failed:** Styled text approximated the Sugar.no logo.

**Guardrail:** Use the official local SVG with its original aspect ratio. Do not depend on runtime website/CDN fetching for core branding.

**Regression:** Check the local asset, alt text, aspect ratio and no third-party request.

### 32. Checkout is the same recognition model as Shelf

**What failed:** Early checkout concepts became a staged animation or a post-purchase judgment flow.

**Guardrail:** Checkout receives one real multi-product scene, the same recognition contract, de-duplication, fit and ranked comparison as Shelf. Do not ask users to undo purchases or shame the basket.

**Regression:** The deterministic real-belt scene returns its verified products and survives an active-camera source switch.

## Mobile Safari and accessibility lessons

### 33. `100dvh` is not a complete iPhone layout strategy

**What failed:** iPhone 17 Pro and orientation changes retained stale viewport height; controls overflowed width.

**Guardrail:** Pin fixed scanner surfaces with `top/right/bottom/left`, include all safe-area insets and keep horizontal product rails explicit. Compact secondary controls where necessary without reducing touch targets.

**Regression:** Maintain the current viewport matrix: 402×874, 874×402, 440×956 and 375×667 with no document overflow.

### 34. Accessibility failures hide in compact states

**What failed:** Muted tray text fell below 4.5:1 contrast and enlarged text exposed navigation races.

**Guardrail:** Validate compact sheet, overlays, dark mode, reduced motion and 125% text, not only the expanded desktop-like state. All actions remain at least 44×44 px with visible focus.

**Regression:** Keep automated WCAG A/AA checks plus targeted contrast assertions for the populated scanner.

### 35. Camera tests need real media readiness semantics

**What failed:** WebKit stayed on `Waiting for camera permission…` because the mock stream never became playable.

**Guardrail:** Camera mocks must provide deterministic video readiness, dimensions and safe canvas frames so tests exercise automatic capture rather than bypassing it.

**Regression:** Permission, broad scan, focused retry, rate limit and provider failure all run through the same readiness harness.

### 36. Avoid fixed sleeps in asynchronous browser tests

**What failed:** Tests inspected state just before the next frame, failed on cold hydration and used page-wide text selectors that matched duplicate copy.

**Guardrail:** Wait for observable requests or UI states with bounded budgets. Scope locators to semantic regions. Open dialogs before targeting their hidden controls.

**Regression:** A test must fail for a broken product outcome, not machine speed or duplicated helper text.

## Privacy, infrastructure and release lessons

### 37. Privacy must be enforced at the API boundary

**What failed:** Analytics initially accepted arbitrary strings and a full user agent, which could allow image-like data or unnecessary identifiers.

**Guardrail:** Reject image/frame/base64-like keys and values, cap fields and lengths, store only a coarse device class and metadata, and keep `imageStored: false` explicit.

**Regression:** API tests must attempt raw data URLs, image-like keys, oversized strings and excess fields.

### 38. Secrets belong only on the server

**What failed:** Live recognition initially had no Railway Gemini key, and key configuration risked becoming an application concern.

**Guardrail:** Keep Gemini and Supabase service-role credentials in Railway/local secret storage only. Never use `NEXT_PUBLIC_`, commit `.env.local` or paste credentials into handoff/design tools.

**Regression:** Release smoke checks key validity without printing the key; browser bundles contain no server secret names or values.

### 39. Railway standalone deployment has platform-specific requirements

**What failed:** The first container bound too narrowly, static assets were missing from standalone output and direct uploads could report an old commit.

**Guardrail:** Keep `HOSTNAME=0.0.0.0`, copy `public` and `.next/static` during `postbuild`, prefer GitHub `main` as the source and ensure `/api/health` reports the exact release SHA.

**Regression:** A release is incomplete until the Railway build succeeds, public health is `ok`, the commit matches and the affected public flow is smoked separately.

### 40. Dependency upgrades need framework compatibility checks

**What failed:** TypeScript 7 and ESLint 10 broke the Next.js 16 lint stack.

**Guardrail:** Preserve the documented TypeScript/ESLint pins until the Next.js plugin stack officially supports newer majors. Upgrade in a dedicated pull request with the full verification suite.

**Regression:** `npm run verify` is mandatory after dependency changes.

### 41. Deterministic scenes prove UX, not computer-vision accuracy

**What failed:** Generated shelf scenes and pinned checkout results could be mistaken for evidence that arbitrary real shelves work.

**Guardrail:** Label deterministic scenes as interaction fixtures. Measure focus top-1, shelf recall, unsupported false positives, checkout duplicates and latency only on ground-truthed physical images.

**Regression:** Use the metadata-only benchmark harness and retain the distinction between source-data coverage and measured visual accuracy in every report.

### 42. A bug fix is not complete without a regression and release evidence

**What failed:** Several issues reappeared as UI copy, overlays or asynchronous state evolved.

**Guardrail:** Every material defect adds the narrowest unit/API/browser regression, a `Bugs.md` entry, a dated `docs/test-runs/` record and a production health/smoke check on the deployed commit.

**Regression:** Reviewers must be able to point from the bug to the exact automated or product acceptance check.

## Change-area checklist

| Area being changed | Read first | Minimum checks |
| --- | --- | --- |
| Gemini prompt/schema | `src/server/recognition.ts`, product-truth sections above | `src/server/recognition.test.ts`, API recognition tests, real-image benchmark |
| Barbora/OFF matching | `src/server/barbora-*.ts`, `src/server/open-food-facts.ts` | wrong-brand, wrong-variant, wrong-size, candidate-margin and price-link tests |
| Nutrition/fit | `src/lib/scoring.ts`, `src/lib/rating-visibility.ts`, `src/lib/match-presentation.ts` | missing-signal, fiber-independence, basis/fair-cohort and copy tests |
| Camera lifecycle | `src/components/scanner-app.tsx`, `src/lib/camera-focus.ts` | multi-product, hold/Scan again, cancellation, 429 and provider-failure WebKit scenarios |
| Upload recognition | `src/lib/upload-scan.ts` | landscape rows, long portrait sections, box remap, de-duplication and body limits |
| Price UI | scanner component plus Barbora rating/offer code | no-label, possible-match, exact-cheaper and equal/higher-price paths |
| Responsive/design | `scanner-app.module.css`, `globals.css` | iPhone viewport matrix, safe areas, 125% text, dark/reduced motion, axe |
| Analytics/privacy | `src/server/event-privacy.ts`, `/api/events` | raw-image rejection, bounded metadata and coarse device class |
| Catalog refresh | `scripts/sync-barbora-*.ts`, generated snapshots | catalog validation, coverage floors, source timestamps and diff review |
| Railway/release | `README.md`, `railway.json` | `npm run verify`, Mobile Safari suite, GitHub main push, Railway success, matching health SHA |

## Product checks before calling a scanner change ready

1. Scan one clear package, repeated facings and a shelf with several distinct variants.
2. Confirm the first result appears before optional retailer enrichment finishes.
3. Move the phone and verify the held result does not change until `Scan again`.
4. Switch Camera → Shelf → Checkout while a request is delayed and verify no stale result wins.
5. Confirm identity-only products remain useful but receive no fit marker, rank or retailer claim.
6. Confirm a trusted cheaper exact product shows both prices and that every weaker evidence state hides the claim.
7. Test small iPhone, iPhone 17 Pro portrait/landscape, enlarged text and permission denial.
8. Verify `/api/health` reports the exact GitHub release after Railway deployment.

The goal is not to make the scanner look certain. The goal is to make every useful result traceable to the strongest evidence the system actually has.
