# Approved Pen production release

## Scope and rollback

- Owner explicitly requested publishing the final version from the Pen task on 3 September 2026.
- Tested implementation: `c1e95dde0419503a08b8a6cb4b1cc7ef1ec0bad1`, merge of production `f8b760e` and staging `3bc58f4` (Pen design `c151e92` plus staging feedback email).
- Immediate rollback: pushed annotated tag `production-before-pen-2026-09-03` on `f8b760e1e975495b6a09909c4329fbd511d637c1`.
- Production recognition/scoring modules and generated catalog/evidence files are unchanged. The opt-in Personal Shelf switch/demo, exact source guards, shared web catalog and initial camera positioning delay are retained.
- Default UI matches final Pen, with source-backed Sugar on compact cards and protein/sugar in expanded cards. Merging the updated nutrition helper no longer duplicates Protein.
- Staging-only Amplitude/Resend keys were NOT copied into production. Production feedback and anonymous event storage use its own Supabase; production email and Amplitude reporting require separate setup.

## Technical evidence

- `npm ci`: passed; audit reported zero vulnerabilities.
- `npm run verify` on `c1e95dd`: passed lint, TypeScript, 59 files / 399 unit tests, catalog validation and production build/standalone preparation. Log: `/tmp/pen-release-verify.log` (also copied to ignored release evidence after tests).
- `CI=1 E2E_PORT=3021 npm run test:e2e` on `c1e95dd`: **51 passed in 1.9 minutes**, no retries used. Log: `/tmp/pen-release-e2e.log`.
- Earlier integration run: 49 passed / 2 failed. The legacy rating-demo test assumed no first-visit welcome; now it follows the onboarding and verifies completion is remembered on return. The viewport test resized the previous document just before navigation, aborting its new responsive-image preload in WebKit; now it navigates away before resizing. Both targeted scenarios then passed without retry.
- Inherited sheet-geometry false failure is resolved by polling the same bounds through the finite entrance transition, rather than sampling its initial 24 px translation. Bounds were not relaxed.
- Screenshots under ignored `test-results/pen-*`: 320, 375, 390, 402, 440 px phones and landscape; feedback with reduced available height, reduced motion, dark system preference and enlarged text. Normal-mode Pen gradient contrast remains an explicit limitation; increased contrast is separately tested. Physical iPhone camera/keyboard behavior is not simulated evidence.
- Non-fatal development warnings: Next image aspect sizing, NO_COLOR/FORCE_COLOR and intentionally cancelled request ECONNRESET during navigation.

## Production database

Before release, Supabase `gkivwusbobnwzrisbkle` had no `products`, `scan_sessions`, `scan_events` or `pilot_feedback` base tables. Confirmed through SQL `to_regclass` and service-role REST 404. Applied checked-in migrations `202608200001_scanner_demo.sql` and `202608310002_pilot_feedback.sql` together in a transaction through Supabase SQL Editor. No existing catalog/source records were changed or seeded.

Readback confirms all three analytics/feedback tables exist, RLS=true, service-role INSERT=true, anon SELECT=false. Each service-role REST table read returns 200. The optional empty managed products table does not replace the versioned source catalog.

## Live release checklist

After GitHub main push and Railway production SUCCESS, record deployment ID, health SHA, sample result check, a clearly labelled synthetic QA feedback row and event readback in ignored `test-results/pen-release-live.md` and the shared Sugar.no update. Provider acceptance is not email delivery; production email remains disabled.

Owner check: open `/?onboarding=1` on an iPhone, try sample -> View all -> product -> back, then real camera on a Riga shelf. Check 3 known products against their labels, one unknown product, deny/re-enable camera, rotate the phone and send feedback. Confirm an ordinary reload does not repeat onboarding. Do not treat deterministic demos as recognition-accuracy evidence.
