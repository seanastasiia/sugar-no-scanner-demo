# Onboarding version 9 sample-first — release-candidate QA

Checked: 2026-09-18

## Scope

- Branch: `codex/onboarding-v9-sample-first`.
- Base revision: `141dc43` (production onboarding version 8).
- Keep the interface English-only.
- Show a concrete ranked product, confirmed sugar and confirmed protein on the first screen before asking for camera access.
- Make `See all 4 sample results` the single coral primary action.
- Keep `Scan my shelf now` as the direct camera action and `Save for my next shop` as the clean-link save flow.
- Preserve the existing price, privacy, recognition, payment and analytics boundaries; anonymous onboarding events now report version 9.
- Production is unchanged until the owner gives a fresh `ПУБЛИКУЙ` approval for this candidate.

## Technical checks

- `npm run check:fast`: passed.
  - ESLint: zero errors and one pre-existing `react-hooks/exhaustive-deps` warning in `scanner-app.tsx`.
  - TypeScript: passed.
  - Vitest: 98 files / 820 tests passed.
- Focused first-screen and onboarding route checks in `scanner.spec.ts`: 9 passed.
- Supported-phone responsive matrix in `pen-iphone-layout.spec.ts`: passed at 320×568, 390×844 and 667×375.
- Focused first-screen plus responsive matrix after compacting the result row: 2 passed.
- `npm run test:e2e:smoke`: 3 passed.
- `npm run verify`: passed.
  - ESLint and TypeScript passed with the same pre-existing hooks warning.
  - Vitest: 98 files / 820 tests passed.
  - Catalog, Barbora coverage and shelf-pilot evidence validation passed.
  - Next.js production build and standalone asset preparation passed.
- `CI=1 WTP_PAYWALL_ENABLED=true npm run test:e2e -- --workers=1`: 71 passed / 10 skipped in 2.7 minutes. The skipped scenarios are guarded by optional Meta and shelf-queue environment flags.
- An earlier parallel production-server run was stopped after deterministic demo requests interfered with one another under concurrency. The official sequential release run above passed; this matches the repository's release configuration.
- `git diff --check`: passed.
- Visual screenshots inspected:
  - `test-results/pen-welcome-320x568.png`
  - `test-results/pen-welcome-390x844.png`
  - `test-results/pen-welcome-667x375.png`

## Product checks before release

1. Open `/?onboarding=1` at 390×844 and confirm the English headline, top product, `Sugar 2.3 g · Protein 36 g / 100 g`, all three actions, price and privacy copy are visible.
2. Tap `See all 4 sample results` and confirm the four ranked products open without requesting camera permission.
3. Return to onboarding, tap `Scan my shelf now` and confirm the camera opens directly.
4. Return again, tap `Save for my next shop` and confirm the shared or copied URL is the clean scanner link with `?saved=1` and no advertising or session parameters.
5. After approval and deployment, confirm Railway completed the `main` build and `/api/health` reports the deployed revision before treating version 9 as live.
