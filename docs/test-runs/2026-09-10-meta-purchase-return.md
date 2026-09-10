# Meta Purchase return repair — 10 September 2026

Base: `aec1b01` (accepted-consent control remains hidden). Application revision: the commit containing this record; deployment and live verification are recorded in shared context after release.

## Problem and change

The owner completed an actual EUR 2.99 purchase and received seven-day access, but Meta Test Events did not show Purchase. A browser regression reproduced a failure when the incoming referrer contained a detailed checkout path: payment verification succeeded while the Meta privacy guard blocked SDK startup.

New Stripe sessions return through `/api/billing/return`. This header-only 303 response has an explicit no-referrer policy, strips all input except a bounded session ID, remains on the same origin and renders no third-party code. Legacy direct successful returns with a detailed referrer use this boundary before verification. Access still requires the existing server-side Stripe and token-ownership validation. No extra payment, refund, schema change or CAPI integration is part of this fix. Purchase also waits for the real SDK handler before persisting its sent marker, and flushes on script load. The earlier browser marker was verified to correspond to the existing paid session, but did not prove delivery to Meta.

The path-specific Next header override is necessary: an initial browser test exposed the global header replacing the route handler's no-referrer header. Redirect referrer policy follows the [W3C algorithm](https://www.w3.org/TR/referrer-policy/#set-requests-referrer-policy-on-redirect).

## Verification

- Reproduction before fix: payment-success UI visible, zero Purchase events; dedicated Playwright test failed at the Purchase expectation.
- Fixed dedicated Mobile Safari regression: passed. Detailed referrer becomes empty, URL tokens are consumed, Purchase contains EUR 2.99 and a hashed event ID, and reload plus replay of the same return does not duplicate it. Stripe status and Meta SDK transport are mocked in this test; no QA purchase is sent to Meta.
- `npm run verify`: passed, 88 Vitest files / 756 tests, lint, typecheck, catalog validators and production build.
- Full browser suite: 71 passed with no retries; four Meta-specific cases skipped because the full suite runs with Meta disabled. All four then passed with Meta enabled on the production build (9.5 s). The dev-server run of the URL-scrubbing case failed after an automatic self-navigation introduced a detailed referrer; trace confirmed that extra navigation. Production build did not reproduce it.

Raw logs are local `/tmp/purchase-repro.log`, `/tmp/purchase-fixed.log`, `/tmp/purchase-verify.log` and `/tmp/purchase-full-e2e.log`; copied to ignored `test-results/meta-purchase-release/` after all tests finish.

## Owner product check

Use the already-paid session in the same Chrome profile to revisit the private return. Confirm seven-day access and exactly one Processed Purchase in Meta Test Events with value 2.99, currency EUR and a hashed event ID. Refresh and replay that same return: access remains, Purchase remains single. Do not buy another pass to test this. Do not place the private recovery URL or session ID into shared documentation.

The initial Railway attempts for b873f27 failed with a Turbopack persistence Rust panic; production remained aec1b01. The final build command clears only generated `.next` before rebuilding. The live-SDK contract now covers a Purchase queued before script load, no duplicate invocation, and withdrawal; all event transport is intercepted locally.

Final follow-up validation: `npm run verify` passed again (88 files, 756 tests); the real Meta SDK contract passed with locally intercepted PageView, Purchase and OnboardingCompleted; all four production Meta browser cases passed (12.1 s). Full browser rerun: 70 passed, four skipped, one external packshot-loading failure; that exact unchanged scenario passed on isolated rerun (4.9 s), consistent with transient image transport failure. Final logs: `/tmp/purchase-final-verify.log`, `/tmp/purchase-final-sdk.log`, `/tmp/purchase-final-meta.log`, `/tmp/purchase-final-full.log`, `/tmp/purchase-packshot-rerun.log`.
