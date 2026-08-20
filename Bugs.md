# Bugs

This file is the running record of scanner defects found and resolved.

## Open

- Real packaging, glare, low-light and physical conveyor accuracy are not validated. The first proof of concept uses supplied or generated images only.
- Barbora exposes protein and total sugars for the selected catalog, but not numeric fiber. Products without an independently verified fiber value must remain unrated.

## Resolved

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
