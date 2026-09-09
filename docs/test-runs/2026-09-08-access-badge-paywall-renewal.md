# Access badge, paywall and renewal — staging verification

Date: 2026-09-08
Branch: `codex/wtp-stripe-staging`
Scope: staging-only willingness-to-pay experiment; production is unchanged.

## Technical checks

- `npm test -- --run src/server/billing-access.test.ts src/lib/wtp-access.test.ts src/app/api/billing/status/route.test.ts` — 3 files, 10 tests passed.
- `WTP_PAYWALL_ENABLED=true CI=1 E2E_PORT=3113 npm run test:e2e -- tests/e2e/paywall.spec.ts --workers=1` — 6/6 Mobile Safari scenarios passed.
- Paywall visual screenshot inspected at the Mobile Safari viewport; CTA and full offer fit without page overflow.
- `npm run verify` — lint, TypeScript, 66 test files / 431 tests, catalog validators and production build passed.
- `WTP_PAYWALL_ENABLED=true CI=1 E2E_PORT=3117 npm run test:e2e -- --workers=1` — full Mobile Safari suite, 61/61 passed cleanly.
- `WTP_PAYWALL_ENABLED=true CI=1 E2E_PORT=3116 npm run test:e2e -- tests/e2e/paywall.spec.ts --workers=1 --repeat-each=3` — 18/18 repeated paywall scenarios passed after waiting for entrance motion before the contrast audit.

## Covered behavior

- free allowance has singular/plural wording and a non-button visual treatment;
- paid access uses `ceil` to show `7 days left` through `1 day left`;
- badge renders only for live camera and uploaded photos, never deterministic demos;
- server distinguishes active, expired and never-purchased states;
- an open page revokes paid access after the server expiry and refreshes the day counter;
- expired access opens renewal copy and the existing Checkout flow can issue a new seven-day entitlement;
- initial, renewal and success dialogs use accessible focus, reduced-motion handling and WCAG-checked colors.

## Owner checks after staging deployment

1. On live camera, confirm the light badge sits below the logo without touching `Leave feedback` or `Show demo`.
2. Open Shelf and Checkout demos and confirm the badge disappears.
3. With test paid access, confirm `7 days left` appears after `Start scanning`.
4. Open the paywall and confirm the new blue scanner hero, coral button and one-time-payment wording feel consistent with the Sugar.no Figma reference.
5. Expiry and repeat purchase are automated because waiting seven real days is not a practical manual acceptance step.
