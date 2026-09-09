# Selling onboarding launch-candidate checks

Date: 2026-09-09  
Branch: `codex/selling-onboarding-preview`  
Application commit: `149b27662fb2a1a0b7a9c9feb565708949034e72`

## Technical checks

- Previous same-commit `npm run verify`: PASS, 66 test files and 437 tests, catalog validators and
  production build.
- `CI=1 WTP_PAYWALL_ENABLED=true E2E_PORT=3122 npm run test:e2e -- --workers=1`: PASS, 64/64 Mobile
  Safari scenarios in 2.5 minutes. This includes selling onboarding, anonymous funnel analytics,
  camera gating, saved-photo upload, allowance counting, paywall, checkout success, restoration,
  renewal, feedback, accessibility, responsive layouts and launch isolation.
- Local preview health: PASS at `http://127.0.0.1:3108/api/health` after restarting the ordinary
  no-paywall preview.
- Remote read-only health: pilot is still `f4c185d` with `wtpPaywall: false`; production is still
  `08a5338`. No environment was deployed or changed.

The browser test server emitted the existing non-failing Next.js logo aspect-ratio warning and
expected request-cancellation `ECONNRESET` messages while tests replaced pages. All 64 assertions
passed and the test process exited 0.

## Owner product check

1. Open `http://127.0.0.1:3108/?onboarding=1` and check the sample and express paths.
2. Confirm the sample result is hidden until `Scan this shelf`.
3. Confirm the offer states the free-scan rule, EUR 2.99 once, seven days, no subscription.
4. Confirm the final CTA is the first action that opens the camera.

The candidate is technically prepared, but live Stripe/webhook/Supabase configuration and a deployed
HTTPS live-payment smoke remain launch gates. Publishing requires a separate explicit owner command.
