# Camera-free rating demo — 3 September 2026

Owner requested an immediately accessible example, without locating one of the 64 covered products in a shop. Application/source commit: `1c035ff4c7a776458e880ab8549ef3f9a1721660`, branch `codex/personal-rank-preview`. The clean commit was tested and pushed before a single direct Railway upload. No scoring formula, generated evidence, database or production changes.

## Implementation and planned checks

Direct `/demo/personal-shelf` entry and `Show demo → New rating demo` use the same `PersonalShelfResults` component and scorer as the scanner. Five existing exact catalog records are selected on the server; no whole-catalog client import, synthetic nutrition, fake camera frame or simulated recognition. The fixed demo context skips managed evidence refresh. The page never mounts `ScannerApp`, requests camera access, calls recognition, or sends scan analytics. Links to the scanner do not prefetch it.

| Example | Score | Rank |
| --- | --- | --- |
| GO PURE CLASSIC, `livinn_lt:03000011072` | 64 | 1 of 2 chips |
| GO PURE NATURAL CRUNCH, `livinn_lt:03000011075` | 61 | 2 of 2 chips |
| GO PURE CANYON, `livinn_lt:03000011074` | Unscored; contradictory source | None |
| BALTAIS plain Skyr, `barbora:jog-skyr-islandes-bez-pied-400-g` | 97 | 1 of 2 yogurts |
| BALTAIS sweet-cream strawberry, `barbora:jogurts-baltais-salda-krej-ar-zem-400-g` | 54 | 2 of 2 yogurts |

These are deliberately selected examples, not a market sample or health guarantee. The invalid source's raw 57.8 g protein is retained only inside its warned source disclosure; neither score borrows it. English labels explain the example while LT/LV source names and ingredients stay unchanged.

Technical plan: verify exact records and ranking; test direct entry/reload with zero camera/API calls; enter via chooser and return to unchanged default Fit; check real/broken packshots, original sources, narrow/dark/200% text/landscape layouts and accessibility; run the complete release suite; publish only preview and verify its health SHA while rechecking production/staging.

Owner check: open the direct demo on a phone, compare within each category, open `Why this score?` and the unscored source disclosure, then use `Back to scanner` when ready to try a real shelf. No photo, camera permission or product search is needed for the demo itself.

## Local verification

- `npm run verify` on `1c035ff`: PASS, 50 Vitest files / 302 tests, lint/types, all catalog validators, standalone build. The demo is a statically generated route.
- `CI=1 npm run test:e2e` on `1c035ff`: PASS, 38/38 Mobile Safari scenarios, 1.3 minutes, no final retries. Four new demo scenarios also passed separately with retries disabled.
- Exact-ID/source parity and zero I/O are unit-tested. The contradictory chip stays unscored; category denominators remain two.
- Direct deep link and reload made zero `getUserMedia` calls and zero `/api/*` page requests. Source links and original ingredients were checked; malformed source values were not corrected or guessed.
- Real packshots loaded in the visual case. All five intentionally broken packshots became neutral placeholders without removing scores. Dark mode, 375 px, 200% root text and landscape had no horizontal overflow; axe WCAG A/AA checks passed.
- Visually inspected `test-results/personal-shelf-demo-rating-ebf76-d-exact-packshots-on-mobile-Mobile-Safari/rating-demo-mobile.png` and `test-results/personal-shelf-demo-rating-c3f10-ssible-on-small-dark-phones-Mobile-Safari/rating-demo-dark-large-text.png`. Generated screenshots remain ignored.
- Initial test corrections: exact Livinn URL expectation changed to the actual `/p/…` source; image tests now wait for hydration and scroll to trigger intentionally lazy below-fold images. Navigation uses Next Link with prefetch disabled. Final assertions passed.
- Expected aborted-request `ECONNRESET` noise remains in dev cancellation tests; assertions passed. The local test server stopped afterward.

Temporary raw logs: `/tmp/sugar-rating-demo-qa.1Sb717/verify.log` and `e2e.log`. This file preserves the durable summary.

UI/UX Pro Max checks informed touch targets, theme tokens, reflow and error fallback. A minimal non-sensitive interface brief was reviewed with Claude; retained the camera-free route, persistent example label and existing disclosure cards. Its suggestion of a three-chip rank denominator was not adopted: the unscored example must be excluded.

## Preview deployment

Target: Railway project `9e2a4887-0e19-4ca7-ae99-d68816542558`, environment `personal-rank-preview`, service `37730464-07ba-482d-9c59-74c04ecdf6db`. Deployment `4cf6dd8d-d333-4bb6-b4a6-830d63816d2d` from clean pushed `1c035ff` reached **SUCCESS**. [Build/deployment logs](https://railway.com/project/9e2a4887-0e19-4ca7-ae99-d68816542558/service/37730464-07ba-482d-9c59-74c04ecdf6db?id=4cf6dd8d-d333-4bb6-b4a6-830d63816d2d).

Before release, production and `main` were `cc80a339fd5643aa3dbd80be808bbeecc24e6c83`; existing staging and its branch were `621609fde8f577e3e2ae8d22c46054062bdd281d`. Preview previously ran `a6ce77e`. Only the preview's `COMMIT_SHA` was updated. No secrets, database migrations/seeds, source refresh, service creation, production/staging mutations or automatic GitHub deployment connection.

Live smoke completed at 10:42:57 UTC: demo HTTP 200, silent HTTP-only session, all five exact product names and disclosures present in server HTML, no video element. Bare recognition API returned 401; authenticated existing Shelf API returned four detections and `imageStored: false`. Preview health returned `ok` with exact SHA `1c035ff4c7a776458e880ab8549ef3f9a1721660`; production and existing staging returned `ok` with the unchanged SHAs above.

Browser verification on the deployed direct link showed 64/61 chip scores, 97/54 yogurt scores, separate denominators of two, and the unscored chip. Clicking the first `Why this score?` exposed the actual component points (10, 2.1, 22.5, 28.9), original Lithuanian ingredients, per-100 g nutrients and exact dated Livinn link. No camera UI appeared. The first old browser handle was stale; it was discarded and a fresh tab verified the route successfully.

Live URL: <https://sugar-no-personal-rank-personal-rank-preview.up.railway.app/demo/personal-shelf>. This evidence-only commit follows the application deployment and does not require another build. Physical-store validation and wider ingredient coverage remain outside this demo task.
