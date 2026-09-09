# WTP production launch

Date: 2026-09-09
Previous production commit: `d5eff3fd49cabef200682c33513d0b7683ef1744`
Pilot source commit: `1a38bb5e961511212539246d17e92677e0228dcd`
Rollback tag: `production-before-wtp-launch-2026-09-09-v2`

## Release boundary

This release merges the tested selling onboarding and one-time seven-day scanner pass into the current production `main`. It preserves the newer production catalog, recognition pipeline, original Sugar.no Fit and opt-in Personal Shelf entry. No production database row is deleted and no secret is committed.

## Local technical verification

- `npm ci`: passed; npm reported three dependency audit findings (two high, one critical) for separate review.
- `npm run verify`: passed — lint, TypeScript, 84 Vitest files / 732 tests, catalog validation and production build.
- Catalog validation: 40 curated rows, 9,707 active Barbora food products, 7,433 with automatic Fit, and 7,512 Personal Shelf observations (2,334 complete, 3,426 provisional).
- Initial `CI=1 WTP_PAYWALL_ENABLED=true npm run test:e2e`: all 71 Mobile Safari scenarios passed; one feedback scenario timed out during its first local page navigation and passed on retry. The same scenario then passed three focused repetitions.
- Focused rerun of the changed onboarding/accessibility and camera-control scenarios: 2/2 passed without retry.
- After merging the concurrent production change `d5eff3f`, `npm run verify` passed again (84 Vitest files / 732 tests and production build), and the complete Mobile Safari suite passed 71/71 without retry.

## Production deployment

- GitHub `main` application release: `8643584570a35a4adf64c9eca9b3db3add83dea7`.
- GitHub-triggered Railway deployment `71462aac-d842-4edf-8c28-db78f64eca47`: `SUCCESS` with the exact application SHA.
- Explicit Railway CLI deployment `8cf3bf89-c294-46e1-bf65-c3a9e6ea2f17`: `SUCCESS` after production Stripe variables and the paywall flag were applied.
- Live `/api/health`: `status: ok`, exact application SHA and `wtpPaywall: true`; catalog counts remained 9,707 active Barbora foods, 7,433 automatic Fits and 7,512 Personal Shelf observations.
- Production root and `?onboarding=1`: HTTP 200. A clean WebKit session displayed `Compare the shelf, not the labels.` at 390 x 844.
- Protected checkout smoke authenticated with the production server-side access configuration and returned HTTP 200 with a `checkout.stripe.com` URL. No payment was submitted.
- Dedicated live Stripe webhook `we_1UDmQcITPocOQHP2hM51CMkJ` is enabled only for the production billing URL and the two supported Checkout completion events. Its signing secret remains only in Railway production.

## Product acceptance

1. Open production with `?onboarding=1` in a clean Safari session and complete both the at-home and in-store paths.
2. Confirm deterministic demos do not use an allowance; a failed/unverified real scan does not use one; camera and gallery rated scans do.
3. After three rated scans, confirm the EUR 2.99 one-time offer appears and clearly says seven days with no renewal.
4. Do not make another real payment unless specifically testing purchase. Use the already verified restore-by-email path for a paid account.
5. Confirm Personal Shelf remains opt-in and switching it off restores original Fit.

## Rollback

If production regresses, deploy tag `production-before-wtp-launch-2026-09-09-v2` and set `WTP_PAYWALL_ENABLED=false`, then verify that `/api/health` reports the rollback SHA and the scanner opens without the WTP gate. The older tag without `-v2` remains at `5f46e8b` and is not the immediate pre-launch production revision.
