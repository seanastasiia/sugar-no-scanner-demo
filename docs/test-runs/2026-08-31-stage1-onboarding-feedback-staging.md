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

The final commit SHA, full verification, staging migration, Railway deployment, health response, and live staging smoke results are appended after deployment.

## Product QA after staging deploy

1. Confirm the production URL still opens without Stage 1 changes.
2. Open the staging URL in a fresh iPhone Safari session and confirm two onboarding screens appear.
3. Confirm Safari does not ask for camera permission until `Open camera` or `Skip`.
4. Allow camera access and scan real products.
5. Submit `Helpful` and `Needs work` feedback and confirm the success state.
6. Reload and confirm onboarding stays hidden.
7. Add `?onboarding=1` and confirm onboarding reappears.
8. Deny camera access and confirm the recovery explanation and `Enable camera` action.
