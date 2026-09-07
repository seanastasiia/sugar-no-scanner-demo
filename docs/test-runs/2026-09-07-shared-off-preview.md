# Shared Open Food Facts preview acceptance — 7 September 2026

## Candidate and boundary

- Implementation commit: `245cf8927c1b94ae3eaef5f79e843fbb9614eab0` on `codex/personal-fit-catalog-preview`.
- Scope: exact dynamic Open Food Facts cards, GTIN/name-alias reuse, isolated ODbL persistence, conflict quarantine and barcode fallback.
- Production `main`, production Railway and production Supabase were not changed.
- Retailer-page shared flags remain off. The new OFF flag remains off until the isolated staging migration is explicitly confirmed and verified.

## Technical checks

| Check | Result |
| --- | --- |
| Focused OFF storage/SQL/API/barcode suite | Pass: 6 files / 36 tests |
| `npm run verify` | Pass: 74 files / 662 tests; catalog validators; Next production build and standalone assets |
| Catalog totals | Pass: 40 curated; 18,554 Barbora identities; 6,822 Rimi; 6 Livin; 1,855 Livinn nutrition rows; 2,489 Livinn identities; 500 + 596 OFF |
| Personal Shelf audit | Pass: 5,150 observations; 1,343 complete + 2,369 provisional; 34 contradictory rows remain neutral |
| `CI=1 E2E_PORT=3012 npm run test:e2e` | Pass: 58/58 Mobile Safari scenarios in 2.1 minutes |
| `git diff --check`, lint, typecheck | Pass |

The first whole-suite run used parallel Vitest workers and three heavy catalog-import tests crossed the five-second test deadline. Each target passed alone; the test configuration now uses one worker because several integration files load the full 20k-record source catalog. The unchanged assertions then passed all 662 tests. This changes test scheduling, not product behavior or acceptance thresholds.

## Trust and privacy checks

- Exact API barcode responses must return the requested checksum-valid GTIN.
- The first dynamic result is normalized before scoring, so the first and later shared reads keep one ID and one composition.
- Search aliases store only a one-way hash of normalized brand/name/variant/pack/barcode fields; raw scan text, users, sessions and images are not stored.
- A conflicting GTIN alias or changed identity/composition is blocked permanently. Missing fields remain unknown and observations are never stitched together.
- RLS and privileges deny `anon` and `authenticated`; only the server service role can read/promote. Immutable observation rows cannot be updated by the service role.
- OFF records stay in separate attributed `ODbL-1.0` tables. Retailer-page data cannot enter them.

## Live checks still required after confirmed staging activation

1. Verify migration objects, RLS, privileges and empty starting counts in the isolated staging Supabase project.
2. Enable only `SHARED_OFF_CATALOG_ENABLED` on the isolated preview service; keep both retailer shared flags false.
3. Confirm Railway deployment SUCCESS and exact `/api/health` commit/feature values.
4. Resolve one real OFF GTIN absent from the checked-in 1,096 records, confirm one attributed database card/observation, then repeat from a fresh request and confirm no duplicate.
5. Re-run the preview HTTPS smoke and visually check Personal Shelf Rank on mobile.

## Owner product checks

1. Scan a clear product barcode not already bundled, open `View all`, and verify protein/sugar and the Personal Fit result against the package.
2. Repeat the same product in a new browser session; it should return the same card faster.
3. Try a different flavour or pack size; it must not borrow the first product's score.
4. Confirm a missing ingredient/fiber value still appears as unknown/provisional rather than zero.
