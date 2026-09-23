# Dependency security release

Date: 2026-09-23

Target: Railway production service `sugar-no-scanner-demo`

## Scope

- Upgrade Next.js from 16.3.1 to the patched 16.3.6 release.
- Keep the matching `eslint-config-next` version at 16.3.6.
- Upgrade Sharp from 0.35.3 to 0.35.4.
- Resolve the transitive development-only `js-yaml` advisory by locking 4.3.2.
- Do not change scanner behavior, catalog data, database schema, environment configuration or product analytics.

## Security evidence

- The official Next.js advisory marks versions `>=16.2.0 <16.3.6` as affected by the critical `next/og ImageResponse` issue and 16.3.6 as patched.
- `npm audit`: passed, 0 vulnerabilities.
- `npm audit --omit=dev`: passed, 0 vulnerabilities.

## Technical verification

- First `npm run verify`: lint and TypeScript passed; 100 test files / 819 tests passed, but the PGlite `beforeAll` hook timed out before 13 SQL tests started. The isolated SQL file then passed 13/13 in 2.38 seconds.
- Repeated `npm run verify`: passed. ESLint had 0 errors and the existing `scanner-app.tsx` hook warning; TypeScript passed; 101/101 test files and 832/832 tests passed; all catalog validators passed; Next.js 16.3.6 production build and standalone asset preparation passed.
- `CI=1 E2E_PORT=3012 npm run test:e2e`: intentionally recorded as non-passing because the command used the test server's default `WTP_PAYWALL_ENABLED=false`; 64 passed, 12 feature-gated scenarios skipped and the 7 paywall scenarios failed. This reproduces the already documented environment mismatch and is not the release configuration.
- `CI=1 WTP_PAYWALL_ENABLED=true E2E_PORT=3013 npm run test:e2e`: exit code 0; 70 clean passes, one feedback scenario passed on its automatic retry after its first navigation timed out, and 12 Meta/queue-gated scenarios were intentionally skipped.
- Focused no-retry confirmation: the feedback scenario passed 3/3 repetitions with one worker and `--retries=0`.
- Pending before publication: `git diff --check`, GitHub `main` push, Railway deployment success and live production smoke.

## Owner product check

After deployment, open the forced welcome screen in iPhone Safari. Confirm the page loads, `See all 4 sample results` opens four ranked products without camera permission, and `Scan my shelf now` can start the real camera flow. This dependency-only release is not expected to change copy, layout, pricing, recognition or privacy behavior.

## Production evidence

Terminal deployment ID/status and live HTTPS smoke results are recorded in the dated canonical shared Sugar.no update only after actual live verification. Required release evidence is Railway `SUCCESS`, `/api/health` reporting the pushed GitHub `main` SHA, root/session availability, bare recognition rejection and authenticated deterministic Shelf recognition with `imageStored: false`.
