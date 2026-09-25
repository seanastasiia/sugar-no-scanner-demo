# Onboarding v11 candidate verification — 25 September 2026

Status: unpublished candidate; production remains `ab5d31f1c4164843a25c8fde285bb1cf5b8cd9ee` (live health OK at 11:50 Riga). No deployment, ad, budget or payment changes.

Code commit: `b3a43eaf43a4f9653cc156ca9857a8f9389862bc`. Its Git tree `88c5b420d782edd7a2b0e76d0f9e173cfbb77d4a` exactly matches the locally verified tree. The local Git CLI lacked HTTPS write credentials, so the existing GitHub connector stored the identical tree in the candidate branch; main was not changed.

## Checks

- `npm run verify`: passed on the identical local tree. ESLint: 0 errors, one pre-existing unnecessary-hook-dependency warning; TypeScript passed; 103 Vitest files / 838 tests passed; catalog validators and Next.js production build/standalone preparation passed.
- `CI=1 WTP_PAYWALL_ENABLED=true E2E_PORT=3101 npm run test:e2e -- --workers=1`: **72 passed, 12 feature-gated scenarios skipped, 0 failed**, 2.5 minutes, on code commit above. The skipped cases require Meta or owner/queue configuration.
- Dedicated Meta run with `META_PIXEL_ID=1084452794318316`, paywall enabled, `meta-consent.spec.ts` and `meta-purchase-return.spec.ts`, one worker/no retries: **4 passed**. All SDK calls are mocked in these tests.
- Focused final UI/scanner run: **6 passed**, one worker/no retries, including all seven phone dimensions/orientations (320×568 through 440×956, plus 667×375 and 874×402), camera-preparation failure analytics, sample scenes and enrichment.
- Read-only SQL exercised in PGlite with QA, demo scans, wrong order, mismatched scan IDs, returning visits and a direct visit retaining old purchase UTM. Only the correct real-scan sequence counts; direct-entry traffic stays outside the ad cohort.
- `git diff --check`: passed. No database migration or generated catalog changes.

## Failures found and resolved during verification

The new comparison initially pushed a secondary control below a small screen and overflowed the narrow landscape column. Compact portrait spacing and a wider landscape grid fixed both; the unchanged visibility/hit-testing assertions pass.

The Meta URL-sanitization test could enter with the detailed test URL as its own referrer after a cold WebKit/development reload. Production code correctly refused to load Meta (zero SDK scripts). The test now supplies a public root referrer to isolate URL sanitization; the separate detailed-referrer payment-return test still passes. No privacy guard was weakened. Earlier full-suite attempts with the wrong paywall/Meta configuration were discarded, not reported as passing.

## Evidence and limits

Local ignored evidence: `test-results/v11-evidence/` contains final logs and phone screenshots; do not commit screenshots. The full run uses a local development server and mocked camera/provider fixtures, not a real Instagram/Facebook browser or paid Gemini call. The production build passed separately; production HTTPS smoke is required after approval/deploy.

The September 24 incomplete scan is still unresolved. Supabase and Railway require restored browser login; the Mac subsequently locked. A real-phone Instagram/Facebook test is pending. Use the read-only incident timeline query and the owner checklist in `docs/scanner-first-value-v11.md`. Publishing requires explicit `ПУБЛИКУЙ`.
