# Personal Shelf owner access

Base: `99af7181697957444c59572a2865b4e90e00fc14`. This report accompanies the owner-access implementation commit; subsequent live proof is recorded in shared context with its exact deployed SHA.

- `npm run verify`: passed; 101 Vitest files, 832 tests, catalog validators and production build. One pre-existing scanner callback dependency lint warning, no errors.
- Final token tamper/expiry/revocation checks after signature hardening: 6/6 passed.
- Final changed-path ESLint and TypeScript: passed.
- Full `CI=1` Mobile Safari suite with queue/paywall enabled and synthetic owner credentials: 79 passed, four Meta-specific scenarios skipped because no Pixel was configured. No retries/failures.
- Owner browser scenario: signed email proof, pilot-scoped cookie, reload persistence, upload despite exhausted three-scan allowance, no billing/funnel requests, unchanged local allowance. Public root in the same browser still shows the normal paywall. Forged-cookie visitor retains that paywall. Pilot Home Screen manifest starts at `/pilot/shelf`.
- Request tests: arbitrary recipient gets no email, cross-origin rejected, provider errors reported. Signature tests include wrong purpose, malformed and Unicode signatures, expiry, secret rotation, identity replacement and disabled configuration.

Local detailed logs: `.catalog-sync/owner-access/{verify.log,token-final.log,e2e.log,lint-final.log,typecheck-final.log}`. Live browser script writes `live-smoke.json` in that same ignored directory; no email proof, signing secret or browser cookie is logged.

Owner acceptance: confirm the email on the phone, check “Owner access · Free scans”, scan and reload; public `/` remains metered. Install the Personal Shelf URL again to use its own manifest. An isolated iOS Home Screen session may require another email confirmation. Links remain usable for their 15-minute validity; sessions last one year and can be revoked by rotating the server secret. Recognition rate limits and research quotas remain.
