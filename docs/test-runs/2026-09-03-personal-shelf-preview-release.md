# Isolated Personal Shelf Rank release — 3 September 2026

User requested a published trial without changing current production. Release branch: `codex/personal-rank-preview`; application deployment commit: `a6ce77e53688093356185486aca8db4005a782ce`. This clean commit was pushed before direct Railway upload. Changes from tested commit `0985975f3abf3fe55633c854d41a441429692bf1` to this release are README/Bugs documentation only. This evidence note and subsequent documentation changes do not require another runtime deployment.

## Isolation and release

- Preview: <https://sugar-no-personal-rank-personal-rank-preview.up.railway.app>.
- Railway project `9e2a4887-0e19-4ca7-ae99-d68816542558`; newly created empty environment `personal-rank-preview`, ID `f83202e1-6a66-4311-b16d-c7ec3fe95541`; new service `sugar-no-personal-rank`, ID `37730464-07ba-482d-9c59-74c04ecdf6db`.
- No environment duplication, production/staging variable edits, main/staging branch pushes, migrations or data seeds. No Supabase/Amplitude credentials in the new service. Checked-in catalog/evidence and preview-only process cache are active. The existing Gemini account key was copied securely from staging; newly generated preview session signing inputs are separate. Secrets are not recorded here.
- Direct `railway up --detach` uploaded the clean pushed tree with explicit project/environment/service selectors. The service has no automatic GitHub source connection; later preview documentation pushes do not deploy anything. `COMMIT_SHA` is the direct-upload fallback, not evidence of a GitHub-triggered build.
- Deployment `10071a24-14fe-4e49-974b-8aacacf2748e`: `SUCCESS`. [Railway build/deploy logs](https://railway.com/project/9e2a4887-0e19-4ca7-ae99-d68816542558/service/37730464-07ba-482d-9c59-74c04ecdf6db?id=10071a24-14fe-4e49-974b-8aacacf2748e).
- Live health at 10:15 UTC: HTTP 200, `status: ok`, exact release SHA `a6ce77e53688093356185486aca8db4005a782ce`.

## Planned technical checks and results

| Check | Result |
| --- | --- |
| `npm run verify` on `0985975` | PASS: lint, TypeScript, 49 files / 300 tests, all catalog validators, Next standalone production build |
| `CI=1 npm run test:e2e` on the same application tree | PASS: 34/34 Mobile Safari scenarios, 1.3 minutes, no final retries; includes real-source pilot cards, category/tie/unknown rules, accessibility and original scanner regression paths |
| `git diff --check`; pushed preview branch | PASS; `main` and `stage/onboarding-feedback` unchanged |
| Preview direct root and session | HTTP 200; secure HTTP-only same-site session issued silently; no user-facing access-code form |
| Protected API boundaries | Bare pilot API 401; cross-origin request 403; malformed IDs 400 |
| No-database exact evidence API | HTTP 200, three exact LT observations returned; unknown ID omitted |
| Deployed product data + local client scorer | `livinn_lt:03000011072` = 64, `03000011075` = 61; contradictory `03000011074` = no pilot score and no original Fit |
| Deterministic Shelf request | HTTP 200; four detections; `imageStored: false` |
| Real Gemini request on checked-in `public/samples/latvia-shelf.jpg` | HTTP 200; 8 detections; `gemini-3.5-flash`; 6,887 ms round trip; `imageStored: false`. This is one smoke image, not an accuracy benchmark. |
| Live Browser UI | Direct entry; Show demo → Shelf demo → View all; original Fit default; enable pilot → missing composition explicitly unscored; disable → original first BAREBELLS result and nutrient row restored |
| Existing production | HTTP 200 / `ok`; unchanged `cc80a339fd5643aa3dbd80be808bbeecc24e6c83` |
| Existing onboarding staging | HTTP 200 / `ok`; unchanged `621609fde8f577e3e2ae8d22c46054062bdd281d` |

Raw local command logs: `/tmp/sugar-personal-preview-qa.qCEvUw/verify.log`, `e2e.log`, `live-smoke.log` (temporary local evidence, not durable artifacts). Metadata-only live smoke harness: ignored `test-results/preview-release-smoke.mts`. Automated visual screenshots remain under ignored `test-results/`; the real-source pilot screenshot is `scanner-personal-shelf-pil-e85e1-ns-in-the-mobile-comparison-Mobile-Safari/personal-shelf-livinn.png`.

The dev E2E server printed expected request-cancellation `ECONNRESET` messages; all assertions passed and the server stopped. Railway warns that the existing config-as-code format needs migration before December 2026; it did not block this build. Initial pre-build HTTP 404s cleared after deployment. No laptop server remains required for the preview.

## Owner product check and honest limits

1. Open the preview on a phone; scan or upload a shelf image. Expand `View all`, then enable `Personal Shelf Rank · Pilot`.
2. For covered products, check the within-category order and `Why this score?` against their packages. Switch off to compare with original Sugar + Protein Fit.
3. Verify incomplete products show missing data, not zero or an invented rank. Check phone camera permission, readability and convenience in a real shop.

The pilot has 198 exact observations but only 64 complete scores. Existing Shelf/Checkout demos lack required composition for the new model; they validate toggle/unknown behavior, not scored ranking. Live demo QA also exposed an ingredient-free cookie-flavoured ICONFIT bar under `Cookies & wafers`; it remains unscored, and this category limitation is logged in Bugs. Real scored-card rendering/explanations were covered by the automated real-Livinn fixture tests; they were not claimed as a successful live camera recognition of those three chip SKUs.

The neutral preference score is unvalidated and not a medical/food-safety guarantee. Physical-store accuracy, expanded ingredient coverage, category calibration and production rollout remain separate owner decisions. The preview URL is public with the existing convenience session, not private viewer authentication; do not broadly distribute restricted retailer data.
