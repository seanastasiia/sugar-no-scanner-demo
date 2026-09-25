# No-match diagnostics candidate validation

25 September 2026. Tested code commit `34bab34187e9d73136d0c371cb8bc6bf8fcc2968`, tree `db40ba1ecdc622cd9eca98f9658bbd3f37e074e2`. Draft PR #1; production is unchanged.

- `npm run verify`: PASS, 103 Vitest files / 839 tests, catalog checks, typecheck, standalone production build. Zero lint errors; the existing unnecessary hook dependency warning remains.
- `CI=1 WTP_PAYWALL_ENABLED=true E2E_PORT=3101 npm run test:e2e -- --workers=1`: PASS, 72 passed, 12 feature-gated skipped, zero failures (2.4 minutes). Mobile Safari emulation with mocked live camera/provider, not a physical Instagram/Facebook test.
- The camera positioning/retry scenario now verifies two separate `scan_no_match` outcomes with no false `scan_completed` or technical `recognition_failed`. The events endpoint accepts the new event. Existing empty-result/paywall recovery coverage passes.
- `git diff --check`: PASS. Local and GitHub source trees are identical.

Local full logs: `test-results/v11-evidence/no-match-verify.log` and `no-match-e2e.log` (ignored). Prior v11 visual, QA and Meta evidence remains in `2026-09-25-onboarding-v11-candidate.md`; this addition does not change the screen or Meta mapping.

## Product acceptance still pending

On a real phone in both Instagram and Facebook: allow camera, scan visible packages, obtain and inspect a real result; repeat with an empty/non-package view and confirm retry is possible. Check saved-photo recovery too. Use explicit QA marking on the candidate after an approved HTTPS deployment. Do not equate emulated camera results with provider accuracy or physical embedded-browser support.

The incident read-only investigation restored access to production Supabase and Railway. Historical events establish camera access/start; a closely timed no-match server response is only temporally correlated because the old implementation did not store the request ID. No photographed scene was retrieved or retained. The new event fixes observability, not the unproven cause of the historical no-match.

No production publication, advertising edit, payment change or database mutation performed. Production still requires explicit owner `ПУБЛИКУЙ`.
