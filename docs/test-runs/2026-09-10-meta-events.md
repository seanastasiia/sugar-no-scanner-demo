# Meta browser funnel verification - 10 September 2026

Application commit: `aa76cb8beced84f944bb4f327a212acd08d21bc6` (initial implementation `df49e94cadd4af87e2cb86b2941a950d2e78d5fc`).

- `npm run verify`: PASS, 85 Vitest files / 738 tests, lint, TypeScript, catalog validators, production build and standalone asset preparation.
- `CI=1 WTP_PAYWALL_ENABLED=true E2E_PORT=3018 npm run test:e2e`: PASS, all 71 existing Mobile Safari scenarios; two feature-gated Meta scenarios skipped. This run covered the initial implementation; the follow-up only guards SDK queue access and closes prototype-name handling in the Meta allowlist.
- `CI=1 E2E_PRODUCTION=1 META_PIXEL_ID=1956266218377681 WTP_PAYWALL_ENABLED=true E2E_PORT=3019 npx playwright test tests/e2e/meta-consent.spec.ts`: PASS, 2/2 on the final application commit. Meta SDK requests are mocked, so these checks do not create advertising traffic. Verified no load before consent/after rejection, one PageView initialization, withdrawal and persisted rejection, URL cleanup, and a 320 px consent layout. Screenshot visually inspected.
- An extra full production-server run on plain local HTTP was stopped: production Secure access cookies do not accompany Safari HTTP API calls, causing demo authorization failures. The normal dev-server suite above passed; deployed HTTPS remains the production acceptance surface.
- Meta dataset settings live-checked: automatic page/product details switched OFF; automatic events and automatic advanced matching already OFF.
- Safari Test Events reports an unsupported browser. Chrome requires the user's Facebook login; receipt in Events Manager remains unverified until that step completes.
- No real payment was made. Purchase eligibility, server-paid amount, private event identity and duplicate suppression are covered by automated tests. CAPI is not configured.

Raw local logs: `/tmp/scanner-meta-verify-final.log`, `/tmp/scanner-meta-e2e-dev.log`, `/tmp/scanner-meta-consent-e2e-final.log`.

Owner check: reject advertising cookies and use Scanner; reopen Ad privacy and allow; inspect PageView and onboarding/payment-step events in Meta Test Events. A genuine purchase should appear once, after Stripe confirmation, and remain single after refreshing the return.

Release: push the verified tree to GitHub main; set only META_PIXEL_ID and COMMIT_SHA on the existing production service; deploy through Railway CLI and confirm live health matches the release SHA. Rollback base: `61be6f5161e1cd111109d7809338c1afc9ae5b4f`; disabling META_PIXEL_ID also removes the integration and consent UI.
