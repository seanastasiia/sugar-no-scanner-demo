# WTP production launch

Date: 2026-09-09
Previous production commit: `5f46e8b8e52220cd970836d86a567a8f5aa8d44f`
Pilot source commit: `1a38bb5e961511212539246d17e92677e0228dcd`
Rollback tag: `production-before-wtp-launch-2026-09-09`

## Release boundary

This release merges the tested selling onboarding and one-time seven-day scanner pass into the current production `main`. It preserves the newer production catalog, recognition pipeline, original Sugar.no Fit and opt-in Personal Shelf entry. No production database row is deleted and no secret is committed.

## Local technical verification

- `npm ci`: passed; npm reported three dependency audit findings (two high, one critical) for separate review.
- `npm run verify`: passed — lint, TypeScript, 84 Vitest files / 732 tests, catalog validation and production build.
- Catalog validation: 40 curated rows, 9,707 active Barbora food products, 7,433 with automatic Fit, and 7,512 Personal Shelf observations (2,334 complete, 3,426 provisional).
- `CI=1 WTP_PAYWALL_ENABLED=true npm run test:e2e`: all 71 Mobile Safari scenarios passed; one feedback scenario timed out during its first local page navigation and passed on retry. No assertion was weakened.
- Focused rerun of the changed onboarding/accessibility and camera-control scenarios: 2/2 passed without retry.

## Production deployment

To be completed after the reviewed commit is pushed to GitHub `main`:

- release commit: pending;
- Railway deployment: pending;
- `/api/health` exact SHA and `wtpPaywall: true`: pending;
- HTTPS onboarding, root and checkout-creation smoke: pending.

## Product acceptance

1. Open production with `?onboarding=1` in a clean Safari session and complete both the at-home and in-store paths.
2. Confirm deterministic demos do not use an allowance; a failed/unverified real scan does not use one; camera and gallery rated scans do.
3. After three rated scans, confirm the EUR 2.99 one-time offer appears and clearly says seven days with no renewal.
4. Do not make another real payment unless specifically testing purchase. Use the already verified restore-by-email path for a paid account.
5. Confirm Personal Shelf remains opt-in and switching it off restores original Fit.

## Rollback

If production regresses, deploy tag `production-before-wtp-launch-2026-09-09` and set `WTP_PAYWALL_ENABLED=false`, then verify that `/api/health` reports the rollback SHA and the scanner opens without the WTP gate.
