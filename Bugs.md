# Bugs

This file is the running record of scanner defects found and resolved.

## Open

- Real packaging, glare, low-light and physical checkout-belt accuracy are not validated. The first proof of concept uses curated sample scenes only.
- Shelf-price OCR and spatial association with the correct product label need a physical Latvian store benchmark; ambiguous labels must remain hidden.
- Barbora is the only live retailer source. The prototype can say `Barbora online`, but cannot claim `best price` until multiple comparable retailers, exact pack-size matching and freshness rules are connected.
- The 19,076-entry sitemap index is a discovery snapshot, not a promise that every page is in stock or that packaging and prices have not changed.
- Barbora exposes protein and total sugars for the selected catalog, but not numeric fiber. Products without an independently verified fiber value must remain unrated.
- Saved options are device-local in the proof of concept and do not sync across browsers or phones.

## Resolved

- **2026-08-21: the camera area felt too small beside the result sheet.** The portrait scanner stage now uses roughly two thirds of the browser viewport, which keeps the camera close to half of the full iPhone display after Safari chrome and safe areas, while results continue below in the normal page scroll.
- **2026-08-20: four facings of Coca-Cola were reported as four recognized products.** Recognition now groups detections by curated ID, exact retailer SKU or normalized brand/product identity and renders one union marker per unique product type.
- **2026-08-20: a possible retailer match for Coca-Cola opened a Pepsi product page.** Retailer page candidates now fail closed on conflicting brands. Possible candidates are not exposed as links or price comparisons; only an exact SKU may open from a scan result.
- **2026-08-20: live results accumulated stale products and changed while the user was reading.** A successful live scan now pauses the video frame and analysis, holds one stable result and offers a 46 px `Scan again` action that clears the previous result before resuming.
- **2026-08-20: the Price check card appeared when no physical shelf label was visible.** The entire price card now requires an explicit separate-label signal, OCR confidence of at least 0.90 and matching EUR text; an exact online offer, deposit, pack size or package number can never create it.
- **2026-08-20: the Top fit/Mixed/Trade-offs legend appeared over unscored Coca-Cola and Activia results.** The legend is now conditional on complete verified nutrition; generic products receive an explicit `Identified, not rated` explanation instead.
- **2026-08-20: the first price cache stored query-specific match confidence by retailer slug.** The five-minute cache now stores only the parsed public product payload; exact/possible confidence is recalculated for every photographed package so one scan cannot lend certainty to another.
- **2026-08-20: random store products outside the 40-snack catalog returned only `Not sure`.** Live recognition now reads any clear package identity, searches a reproducible 19,076-page Barbora index and keeps unverified products separate from the curated nutrition score.
- **2026-08-20: the first broad-recognition JSON schema exceeded Gemini's accepted structured-output complexity.** Identity fields were compacted into brand, full product name and retailer search query while retaining boxes and shelf-price evidence; the resulting schema succeeds against `gemini-3.7-flash`.
- **2026-08-20: generic token matching could present an unrelated low-confidence Barbora product.** The resolver now suppresses weak candidates and requires a confidence-and-margin rule for exact SKU status; non-exact candidates remain internal and cannot drive a retailer link or price comparison.
- **2026-08-20: `ThinkingLevel.MINIMAL` produced a model-specific `INVALID_ARGUMENT`.** The scanner remains on the supported `LOW` level.
- **2026-08-20: live camera could not complete a Gemini scan.** `GEMINI_API_KEY` was absent from Railway, and after the credential was installed Gemini rejected the 40-value product-ID enum as `INVALID_ARGUMENT`. Gemini API is now enabled, a dedicated service-account-bound authorization key is restricted to it and stored only in Railway, and the current pipeline keeps generic package identity separate from exact-SKU nutrition assignment instead of placing the whole catalog in the provider schema.
- **2026-08-20: the enlarged-text WebKit check could race a development-server navigation.** The test now installs its font-size override before navigation, avoiding a destroyed execution context while preserving the accessibility scenario.
- **2026-08-20: the Checkit design reference used the US App Store storefront.** Documentation now links to the same app through the Latvia storefront used for this proof of concept.
- **2026-08-20: direct Railway uploads could report the previous Git SHA in `/api/health`.** Railway does not supply `RAILWAY_GIT_COMMIT_SHA` to CLI-uploaded builds, so the documented release command now refreshes the non-secret `COMMIT_SHA` fallback before deployment.
- **2026-08-20: two compact helper labels missed WCAG AA contrast.** Automated axe coverage found the scan hint at 4.21:1 and the per-100-g note at 4.08:1; both now use darker ink values and are rechecked on the populated shelf result.
- **2026-08-20: sample shelf and checkout scenes looked like artificial UI cards instead of camera evidence.** Both samples now use photorealistic concept images while all Sugar.no markers remain real HTML overlays driven by the recognition response.
- **2026-08-20: large colored labels obscured packages and collided on narrow boxes.** Each package now has a compact icon marker; only the selected package expands its text label. A separate legend pairs every color with an icon and plain-language state.
- **2026-08-20: the result sheet repeated nutrition in several large cards and pushed alternatives too far down.** Protein, fiber and sugar values now live inside one compact three-criterion Sugar.no badge, the save action sits beside the product heading and similar options remain horizontally scrollable.
- **2026-08-20: protected sample images failed through the Next.js image optimizer.** The first-party static sample files now bypass server-side optimization because the auth proxy correctly blocks the optimizer's unauthenticated internal fetch.
- **2026-08-20: moving between the shelf and checkout demo required closing the scanner.** Sample results now include a visible `Shelf / Checkout` switch that changes the full scene in place.
- **2026-08-20: checkout said to save an alternative for next time but had no save action.** Products and similar options can now be saved or removed, persist after reload in browser storage and appear in a dedicated `Saved options` list.
- **2026-08-20: checkout looked like an artificial single-product animation.** Checkout now uses the same one-frame multi-product recognition contract as the shelf and returns four detections over one full-belt scene.
- **2026-08-20: the numeric Sugar.no Match was difficult to interpret.** The primary UI now shows a Sugar.no badge with separate Protein, Fiber and Sugar states. The internal number remains only for deterministic ranking.
- **2026-08-20: colored detection labels overlapped on narrow product boxes.** Overlay labels are constrained to each box and use compact `Top fit`, `Mixed` and `Trade-offs` wording; full explanations remain in the product card.
- **2026-08-20: a badge criterion end-to-end selector matched both `Sugar.no` and `Sugar`.** The browser test now scopes the criterion to the badge and requires an exact text match.
- **2026-08-20: the first Railway containers were unreachable by the platform health check.** Railway supplied a container hostname that made the standalone Next.js server bind too narrowly. Production now sets `HOSTNAME=0.0.0.0`; `/api/health` is reachable through the public HTTPS domain and the GitHub deployment is healthy.
- **2026-08-20: health metadata could retain an old manually configured commit.** The endpoint now prefers Railway's deployment-specific `RAILWAY_GIT_COMMIT_SHA` and uses `COMMIT_SHA` only as a local fallback.
- **2026-08-20: lint crashed with the newest TypeScript and ESLint majors.** `eslint-config-next@16.3.1` currently depends on plugins that reject TypeScript 7 and ESLint 10 APIs. The project pins TypeScript 6.0.3 and ESLint 9.39.5 until the Next lint stack supports the newer majors.
- **2026-08-20: checkout detections could merge against stale React state.** The tray now has a synchronous ref used by the recognition loop, while React state remains the rendered copy.
- **2026-08-20: saved images could exceed the recognition API body limit.** Uploads are resized and converted to a bounded JPEG in the browser before transmission.
- **2026-08-20: the PWA shell cached the protected home route.** Navigation is now network-only with an offline fallback; authenticated HTML is never pre-cached.
- **2026-08-20: access-page styles were missing from the first UI patch.** The private gate now has a complete mobile layout, visible focus state and 50 px submit target.
- **2026-08-20: analytics accepted arbitrary string metadata.** The API now rejects image-like keys, data-image values, oversized strings and excessive fields before logging or storage.
- **2026-08-20: the access redirect accepted protocol-relative paths.** Redirects now require a same-origin path beginning with one slash.
- **2026-08-20: Vitest collected Playwright specs.** Unit-test discovery is now scoped to `src/**/*.test`, keeping browser scenarios in the Playwright runner.
- **2026-08-20: the access proxy was outside the active `src` tree.** Next.js did not load the root-level file when the App Router lived under `src/app`; moving it to `src/proxy.ts` makes the investor gate protect pages and APIs.
- **2026-08-20: shelf overlays collided on an iPhone-size render.** Match labels now sit inside their boxes, the redundant shelf rail is hidden and the camera framing guide appears only for camera/upload sources.
- **2026-08-20: Match percentiles excluded usable fields from incomplete products.** Each metric now uses every verified value in the 40-product category population; an individual product still receives no total Match if any of its three inputs is missing.
- **2026-08-20: analytics stored the full user-agent in a field named `user_agent_class`.** It now stores only `ios_safari`, `android_chrome`, `mobile_other`, `desktop` or `unknown`.
- **2026-08-20: production used `next start` with a standalone build.** The release now starts `.next/standalone/server.js`, and `postbuild` copies the public and static assets required by that server.
- **2026-08-20: production cookies could not be exercised by local HTTP smoke tests.** The cookie is now `Secure` whenever the external request protocol is HTTPS (including `x-forwarded-proto` on Railway) and remains testable on loopback HTTP.
- **2026-08-20: checkout controls collided with the status and capture-zone labels.** The pause control now shares the top control row, the redundant capture-zone label is removed and status reports the number of unique saved products.
- **2026-08-20: the PWA exposed only an SVG icon.** It now includes 192 px, 512 px and 180 px Apple touch PNGs, all available before authentication for install metadata.
- **2026-08-20: model boxes could mathematically extend beyond the frame.** Server output now fits every box to the normalized viewport and drops near-zero boxes before rendering.
- **2026-08-20: one analytics session ID could span shelf, checkout and camera modes.** Every new scan experience now starts a fresh random session while related events retain the same ID.
