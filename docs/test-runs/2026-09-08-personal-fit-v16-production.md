# Personal Fit v1.6 production release - 8 September 2026

## Scope

- Owner explicitly approved publishing the completed Personal Fit catalog candidate.
- Integrated the catalog branch onto the current GitHub `main` baseline instead of replacing newer production recognition fixes.
- Published the completed 591-card Barbora evidence cohort and exact package mass/volume provenance for 178 Rimi ice-cream observations reported per 100 ml.
- The conversion affects a scoring copy only. Raw source nutrition remains per 100 ml, and 84 records with other missing or contradictory evidence remain unscored.
- Personal Fit formula, category weights, score bands, original Sugar + Protein Fit and production feature flags are unchanged.
- The 100-card internet pilot and provisional-range simulation remain research evidence only. They promoted no internet card, wrote no database row and activated no new scoring policy.

## Technical checks

- Release commit `e15b46999932e94210f5e7d560bcd3d8663a643a` passed `npm run verify` after integration with production.
- ESLint and TypeScript passed.
- Vitest passed: 76 files, 679 tests.
- Catalog validation passed: 40 curated rows, 9,707 active Barbora food identities, 7,433 automatic Fit products, 6,822 Rimi snapshot rows, 2,489 Livinn edible identities, 1,096 nutrition-bearing OFF rows, 9,626 identity-only OFF rows and 0 CSP rows.
- Personal Shelf validation passed: 7,493 exact source observations, 2,332 complete scores and 3,371 provisional ranges across 19 supported categories. The remaining 1,790 observations stay unscored.
- Next.js 16.3.1 production build passed and generated all 14 routes plus standalone assets.
- GitHub `main` advanced by fast-forward-safe merge from `7416791d56ccbbd7322a6c68f25feefc01e97178` to `e15b46999932e94210f5e7d560bcd3d8663a643a`.
- Railway production deployment `0917b93d-179e-4e5c-af7b-680f204abbf6` completed with `SUCCESS` for the exact release commit.
- Live `/api/health` returned `status=ok`, exact commit `e15b46999932e94210f5e7d560bcd3d8663a643a`, model `personal-shelf-v1.6-exact-basis` and the exact 7,493 / 2,332 / 3,371 / 1,790 evidence counts.
- Headless iPhone 13 WebKit smoke passed over production HTTPS: rating demo HTTP 200 with four cards; sample shelf kept Personal Fit opt-in; the six-signal criteria line and Snack bars region rendered; `More products` and `Nutrition not verified` were absent; switching off restored all four original Fit cards.

## Product checks

1. Open production on the phone and upload a real shelf photo.
2. Open `View all`, enable `Personal Shelf Rank`, and confirm only scored or provisional cards appear.
3. Confirm the compact line says `Sugar · Protein · Ingredients · Salt · Saturated fat · Fiber`.
4. Confirm the cards remain neutral, while Great/Moderate/Low color stays inside the gradient Fit badge.
5. Compare one ice-cream shelf that previously lacked a rating because its table was per 100 ml; only an exact package with both mass and volume may gain a score.
6. Disable Personal Shelf Rank and confirm the original Sugar + Protein Fit list returns unchanged.

## Recovery

- Rollback tag: `production-before-personal-fit-v1.6-2026-09-08` at `7416791d56ccbbd7322a6c68f25feefc01e97178`.
- Shared OFF persistence remains disabled and CSP remains disconnected. The checked-in identity layer still supports recognition without turning incomplete data into nutrition facts.
