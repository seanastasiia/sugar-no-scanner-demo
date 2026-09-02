# Stage 1 onboarding and feedback — staging test log

Date: 2026-08-31 (Europe/Riga)

Branch: `stage/onboarding-feedback`

Baseline: `d127ef8275d81c3d8e725a70096a3956254315d5`

Production safety:

- production rollback tag: `production-baseline-2026-08-31`
- secondary golden rollback tag: `scanner-golden-3c83a65`
- no Stage 1 merge or deployment to production

## Baseline before implementation

- `npm ci`: passed, 0 vulnerabilities
- `npm run verify`: passed; 45 test files and 234 tests, catalog validation, production build
- `CI=1 npm run test:e2e`: passed; 30/30 Mobile Safari scenarios

## Stage 1 scoped checks

- `npm run check:fast`: passed; lint, typecheck, 47 test files and 241 tests
- `npm run test:e2e:smoke`: passed; 3/3 matching critical Mobile Safari scenarios
- targeted Mobile Safari onboarding/feedback/permission/accessibility run: passed; 5/5 scenarios

## Staging infrastructure verification — 2026-09-01

- isolated Supabase project `sugar-no-scanner-staging` created in Central EU (Frankfurt)
- all eight migrations through `202608310002_pilot_feedback.sql` applied successfully
- Data API tables are unavailable to `anon` and `authenticated`; only the Railway server role can write analytics and feedback
- Railway staging deployment `6bd5fd98-1619-4c23-9022-2f732d60c320`: `SUCCESS`
- staging `/api/health`: `ok`, commit `c24065d`
- authenticated live `POST /api/events`: `200`, `storage: supabase`
- authenticated live `POST /api/feedback`: `200`, `storage: supabase`
- both control rows were read back from `scan_events` and `pilot_feedback`
- production `/api/health`: `ok`, commit `d127ef8275d81c3d8e725a70096a3956254315d5`

## One-screen onboarding checks — 2026-09-01

- design direction reviewed with Claude using only the public staging URL and non-sensitive UX requirements
- `npm run check:fast`: passed; lint, typecheck, 47 test files and 241 tests
- targeted Mobile Safari onboarding, forced-QA, Skip, and feedback run: passed; 4/4 scenarios
- iPhone 13 local screenshot inspected: one screen, no clipping, actions visible without scrolling
- `npm run verify`: passed; lint, typecheck, 47 test files and 241 tests, catalog validation, production build
- `CI=1 npm run test:e2e`: passed; 33/33 Mobile Safari scenarios, including the entry accessibility audit
- implementation commit: `081718b521e464ff29dd1cd8e2a190921fe241fa`
- Railway GitHub-source deployment `63702ec8-9139-41b5-83b6-3c7f2bc48d95`: `SUCCESS`
- live staging DOM: new heading and both actions present; old two-screen copy absent
- live Supabase readback: `app_opened`, `onboarding_started`, and `onboarding_step_viewed` stored with `onboardingVersion: 2`
- staging `/api/health`: `ok`, implementation commit `081718b521e464ff29dd1cd8e2a190921fe241fa`
- production `/api/health`: `ok`, unchanged commit `d127ef8275d81c3d8e725a70096a3956254315d5`

## Product QA after staging deploy

1. Confirm the production URL still opens without Stage 1 changes.
2. Open the staging URL in a fresh iPhone Safari session and confirm one onboarding screen appears with `Compare the whole shelf.`
3. Confirm Safari does not ask for camera permission until `Open camera` or `Skip`.
4. Allow camera access and scan real products.
5. Submit `Helpful` and `Needs work` feedback and confirm the success state.
6. Reload and confirm onboarding stays hidden.
7. Add `?onboarding=1` and confirm onboarding reappears.
8. Deny camera access and confirm the recovery explanation and `Enable camera` action.

## Visual onboarding refinement — 2026-09-02

- scope: staging only; recognition, fit, catalog, pricing, nutrition, feedback and analytics behavior unchanged
- design review: Claude reviewed only the public staging URL and two public demo screenshots; its proposed real-demo crop and short hierarchy were adapted to the verified scanner behavior
- copy: the instruction is reduced to eight words, the image caption describes only verified sugar/protein fit, and the processing notice is reduced to one factual sentence
- asset: one 4:3 crop from the existing public demo result, optimized to a 235 KB JPEG
- targeted onboarding/forced-QA/Skip Mobile Safari run: passed; 3/3 scenarios
- iPhone SE 375×667 local screenshot inspected: one screen, no clipping, real scan visual visible, `Open camera` and `Skip` both above the fold
- `npm run verify`: passed; lint, typecheck, 48 test files and 247 tests, catalog validation, production build
- `CI=1 npm run test:e2e`: passed; 33/33 Mobile Safari scenarios, including camera gating and entry accessibility
- implementation commit: `3d91e88ce3b48c1a9b41bd363c54512e3701497e`
- Railway staging active deployment after the implementation push: `667a3f4c-0950-4de9-ba9d-6696fc5a5d50`, online
- staging `/api/health`: implementation commit `3d91e88ce3b48c1a9b41bd363c54512e3701497e`
- live staging DOM: short instruction, real scan preview, compact processing note and both actions present
- production `/api/health`: unchanged commit `d127ef8275d81c3d8e725a70096a3956254315d5`

## Approved Sugar.no design and motion transfer — 2026-09-02

- scope: staging only; production, recognition, fit, catalog, pricing, nutrition and feedback contracts unchanged
- design: cool `#F2F2F7` product canvas, black/coral Sugar.no wordmark, real scanner crop, overlaid four-product result summary, accessible dark-coral primary action and ink secondary action
- motion: short staggered entrance, one non-looping scan pass, subtle button feedback and a complete `prefers-reduced-motion` fallback
- sample path: `Try a sample shelf` now opens the deterministic shelf demo without requesting camera permission; only `Open camera` requests access
- analytics: this redesign emits `onboardingVersion: 3` so staging results do not mix with the previous screen
- targeted Mobile Safari onboarding/camera/sample/reduced-motion run: passed; 4/4 scenarios
- local visual checks: 390×844, 375×667 and 844×390 all had no document overflow; both actions and the privacy note remained visible; minimum action height was 44 px; browser console errors were empty
- `npm run verify`: passed; lint, typecheck, 48 test files and 247 tests, catalog validation and production build
- `CI=1 npm run test:e2e`: passed; 34/34 Mobile Safari scenarios, including entry accessibility, reduced motion, camera gating, feedback and scanner regressions
- implementation commit: `ebff73198175047a467afdf11367e55015bb68bc`
- Railway staging GitHub-source deployment: `be27bc28-8d4d-44b4-a885-2efa482f9f87`, `SUCCESS`
- staging `/api/health`: `ok`, implementation commit `ebff73198175047a467afdf11367e55015bb68bc`
- live staging DOM: approved heading, result summary, two 44+ px actions and privacy note present; no overflow or console errors at 390×844
- live `Try a sample shelf`: deterministic shelf opened with no camera-denied path
- direct Railway source upload returned HTTP 404 before creating a deployment; the pushed staging branch triggered the verified GitHub-source deployment instead
- production `/api/health` was `ok` at pre-existing commit `cc80a339fd5643aa3dbd80be808bbeecc24e6c83`; this task did not deploy or modify production
