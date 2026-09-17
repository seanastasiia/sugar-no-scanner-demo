# Gemini recovery and onboarding version 8 — production release QA

Checked: 2026-09-17

## Scope

- Branch: `codex/rimi-lidl-catalog-expansion`.
- Base revision: `07bdc210cdc20bee6dc05c8ab03dbb0246b8638d`.
- The owner gave the required fresh `ПУБЛИКУЙ` approval on 17 September 2026.
- Retry a transient Gemini `503` once on the primary recognition model, then make one bounded request to `gemini-3.7-flash`.
- Distinguish daily quota, short rate limit, provider overload and provider configuration failures without logging image or user data.
- Keep Google Search-grounded nutrition on the dedicated `gemini-2.5-flash` model instead of inheriting a Gemini 3 vision model.
- Replace the multi-step first-run flow with one decision screen: open the camera immediately, open the four-product sample immediately, or save the clean link for the next shop.
- Preserve the full offer disclosure before action: three successful scans free, then €2.99 once for seven days, with no subscription.

## Provider and quota evidence

- Railway production logs contained successful recognitions interspersed with Gemini `503 UNAVAILABLE` high-demand responses.
- The grounded nutrition path returned `429 RESOURCE_EXHAUSTED`.
- Google AI Studio showed the `Coach` project on the free tier, with a five-request-per-minute limit and a 20-request-per-day model limit for the selected Gemini Flash family.
- Gemini 3 Search grounding had no free daily allowance in this project; Gemini 2 and 2.5 Search grounding showed a separate free allowance, while the underlying free model-request limit remained 20 per day.
- Later on 17 September, the owner upgraded the production `Coach` project to Paid Tier 1 with EUR 25 prepaid credit and auto-reload off. AI Studio showed 10,000 model requests per day and 1,500 grounded-search requests per day; the owner then confirmed a real production scan works.

## Technical checks

- Focused recognition, grounded nutrition and shelf-research tests: 3 files / 58 tests passed.
- `npm run verify`: passed on the final release-candidate state.
  - ESLint: zero errors and one pre-existing `react-hooks/exhaustive-deps` warning in `scanner-app.tsx`.
  - TypeScript: passed.
  - Vitest: 98 files / 820 tests passed.
  - Catalog, Barbora coverage and shelf-pilot evidence validation: passed.
  - Next.js production build and standalone asset preparation: passed.
- `WTP_PAYWALL_ENABLED=true npx playwright test --workers=1`: 71 passed / 10 skipped.
- The full verification and browser suite were repeated after release approval with the same result: 98 files / 820 tests, all catalog checks and production build passed; 71 Mobile Safari scenarios passed and 10 environment-gated scenarios were skipped.
- The browser suite covered direct sample results, direct camera entry, save-for-later, explicit quota recovery copy, supported phone/tablet layouts and the existing comparison flows.
- Responsive first-screen screenshots:
  - `test-results/pen-welcome-320x568.png`
  - `test-results/pen-welcome-390x844.png`
- `git diff --check`: passed.

## Owner checks after deployment

1. Open `/?onboarding=1` on an iPhone-sized screen and confirm the three actions, price and privacy copy fit without scrolling.
2. Tap `Try a sample shelf` and confirm all four sample products appear immediately without a camera prompt.
3. Return to onboarding, tap `Start a free shelf scan` and confirm the camera opens immediately.
4. Tap `Save for my next shop` and confirm the clean scanner link can be shared or copied.
5. Complete one real shelf scan and inspect Railway logs: it should succeed on the primary model or explicitly record fallback/quota status without image data.

## Release configuration

- Set `GEMINI_RECOGNITION_FALLBACK_MODEL=gemini-3.7-flash`.
- Set `GEMINI_WEB_NUTRITION_MODEL=gemini-2.5-flash`.
- Push the tested commit to `main`, wait for Railway deployment success, confirm `/api/health` reports the deployed revision, then perform the real-scan owner check.
