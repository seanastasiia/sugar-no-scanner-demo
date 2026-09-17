# Save-for-later first-screen candidate

Date: 2026-09-17  
Implementation commit: `8af415f`  
Branch: `codex/rimi-lidl-catalog-expansion`  
Release state: local candidate only; not pushed or deployed pending explicit owner approval.

## Technical checks

- `npm run lint` — passed with the existing non-blocking `scanner-app.tsx:662` exhaustive-deps warning and no errors.
- `npm run typecheck` — passed.
- `npm test` — 98 files and 816 tests passed.
- `npm run build` — Next.js production build and standalone asset preparation passed.
- `npx playwright test tests/e2e/scanner.spec.ts --grep "first visit explains|at-home onboarding can be saved|save for later falls back|onboarding motion"` — 4 Mobile Safari checks passed.
- `npx playwright test tests/e2e/pen-iphone-layout.spec.ts` — 2 Mobile Safari checks passed across 320×568, 375×667, 390×844, 402×874, 440×956 and landscape sizes. The first run exposed the new third action below the visible area at 390×844; the candidate reduced only the first-screen preview at medium phone heights and the rerun passed.

The checks cover touch-target visibility, no horizontal overflow, reduced motion, WCAG scanning of the first screen and save dialog, clean shared URLs, focus restoration, analytics events and absence of camera permission during save-for-later.

## Product check after release approval

Open the Meta destination in Instagram or Facebook. Confirm that `Save for my next shop` is visible without scrolling, opens the system share/copy sheet without requesting camera access, and explains how to add the saved link to the phone home screen from Safari or Chrome. Send the link to yourself, reopen `?saved=1`, and confirm the first screen loads. Then verify `onboarding_save_prompt_viewed`, `onboarding_save_action` and `onboarding_saved_link_opened` under onboarding version 8 in the funnel.
