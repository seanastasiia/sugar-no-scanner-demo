# Onboarding version 9 sample-first — production release QA

Checked: 2026-09-18

## Scope

- Branch: `codex/onboarding-v9-sample-first`.
- Base revision: `141dc43` (production onboarding version 8).
- Keep the interface English-only.
- Show a concrete ranked product, confirmed sugar and confirmed protein on the first screen before asking for camera access.
- Make `See all 4 sample results` the single coral primary action.
- Keep `Scan my shelf now` as the direct camera action and `Save for my next shop` as the clean-link save flow.
- Preserve the existing price, privacy, recognition, payment and analytics boundaries; anonymous onboarding events now report version 9.
- The owner gave the required fresh `ПУБЛИКУЙ` approval on 18 September 2026.

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

## Production release evidence

- Tested implementation commit `2111de4603e158fdb69d4c19785a5c890534a3bb` was pushed to GitHub `main`.
- Rollback tag `production-before-onboarding-v9-2026-09-18` points to production version 8 commit `141dc436b0082ac64951491a93dc3dca3667375b`.
- Railway direct deployment `e094085d-3b65-4b16-a2cc-6aad8784b5a9` completed with `SUCCESS`.
- Production `/api/health` returned `status: ok`, service `sugar-no-scanner-demo` and commit `2111de4603e158fdb69d4c19785a5c890534a3bb`.
- Live Mobile Safari smoke returned HTTP 200 and confirmed the English headline, top product, full nutrition line and all three actions.
- After declining Meta cookies, `See all 4 sample results` produced `4 products · 4 with Sugar.no fit` without a camera request.

## Owner checks after release

1. Open `/?onboarding=1` at 390×844 and confirm the English headline, top product, `Sugar 2.3 g · Protein 36 g / 100 g`, all three actions, price and privacy copy are visible.
2. Tap `See all 4 sample results` and confirm the four ranked products open without requesting camera permission.
3. Return to onboarding, tap `Scan my shelf now` and confirm the camera opens directly.
4. Return again, tap `Save for my next shop` and confirm the shared or copied URL is the clean scanner link with `?saved=1` and no advertising or session parameters.
5. Complete one real shelf scan on a phone in a shop; automated checks verify the flow but cannot establish real-shelf recognition accuracy.
