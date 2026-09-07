# Personal Fit production release - 7 September 2026

## Scope

- Owner approved publishing all completed Personal Fit preview work to production.
- Merged `codex/personal-fit-catalog-preview` into the current production `main` baseline.
- Original Sugar + Protein Fit remains the default and unchanged; Personal Shelf Rank is opt-in.
- Production receives the 19-category bounded model, compact quick-decision cards, Great/Moderate/Low badges, rated-only final results, corrected LAKTO cherry identity handling, expanded exact-source evidence, regional Open Food Facts nutrition and identity-only layers, and CSP import support.
- Identity-only or incomplete records never become nutrition facts or scores. CSP remains empty until an official permitted file is issued.
- Uncommitted evidence from the interrupted 591-row Barbora retry was excluded from the release.

## Pre-release verification

- `npm run check:fast`: ESLint, TypeScript, 75 Vitest files and 670 tests passed after merging current production.
- `npm run verify:catalog`: passed. It accounted for 20,120 exact source records, 9,626 OFF identity-only rows, 6,949 Personal Shelf observations and 5,156 assessable observations.
- `npm run catalog:audit:personal-fit`: passed with no duplicate source IDs or evidence IDs and no evidence outside inventory.
- `npm run catalog:report:personal-fit`: completed; category-distribution alerts remain documented calibration signals, not validation failures.
- `CI=1 E2E_PORT=3016 npm run test:e2e`: 58/58 Mobile Safari scenarios passed, including the merged production analytics flow and Personal Shelf presentation/visibility cases.
- `npm run build`: Next.js 16.3.1 production build passed; 14 routes generated and standalone assets prepared.
- Production Supabase preflight confirmed that the Personal Shelf evidence tables are installed. Shared OFF card/identity and CSP tables are not yet installed, so those persistence flags must remain disabled until their additive migrations are applied.
- `railway run ... npm run supabase:seed:shelf-pilot -- --apply`: uploaded and read back all 6,274 retailer and 675 Open Food Facts observations. No rows were deleted.

## Product checks

1. Open production, run a sample or saved shelf, tap `View all`, and enable `Personal Shelf Rank`.
2. Confirm only scored or provisional products appear; unverified products and `More products` are absent.
3. Confirm the page starts with `Best product` or `Best products`, category sits inside each white card, and fit color appears only in the gradient badge.
4. Open `How scores work`, then disable Personal Shelf Rank and confirm original Fit returns unchanged.
5. Open `Show demo` → `New rating demo` and confirm the compact chip cards render.

Application commit, migration status, Railway deployment and live checks are appended after release.
