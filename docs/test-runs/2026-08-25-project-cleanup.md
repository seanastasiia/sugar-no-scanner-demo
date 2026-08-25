# Project cleanup and Codex cost review

Date: 2026-08-25

Base production commit: `9eef0fbbdd1009565c8a64d373a27fefa91ac80a` plus the reviewed cleanup diff.

## Scope

- Added project-local Codex defaults: balanced model, medium reasoning and default service tier.
- Added tiered checks and a four-scenario Mobile Safari smoke command.
- Reduced active README and Bugs documentation to current behavior and open risk.
- Removed the rejected Pen design study and 43 superseded release logs from the active tree; Git remains the archive.
- Removed one unused development dependency and unused public exports/types.
- Aligned local `main` with `origin/main`; the previous unique camera-speed point remains in `codex/camera-speed-backup`.
- Preserved all pre-existing dirty screenshot and `next-env.d.ts` changes.

## Technical checks

- Active relative documentation links: PASS, 7 documents checked.
- `npm run verify`: PASS.
  - ESLint: PASS.
  - TypeScript: PASS.
  - Vitest: 23 files, 126 tests passed.
  - Next.js production build: PASS.
- `CI=1 npm run test:e2e`: PASS, 24/24 Mobile Safari scenarios; `test-results/.last-run.json` reports `passed` with no failed tests.
- `npm run test:e2e:smoke`: PASS, 4/4 scenarios in 9.2 seconds.
- Static unused-code audit: no unused npm dependencies remain. `public/sw.js` is intentionally registered by URL at runtime; remaining internal declarations were made non-exported.

## Owner product checks

1. Open the production scanner and confirm live camera still starts.
2. Open Shelf and Checkout demos and confirm their rated products and `View all` flow.
3. Upload a dense shelf photo and confirm at most five products appear.
4. For the next small UI request, confirm Codex uses the small-change lane and does not run the full release workflow repeatedly.
