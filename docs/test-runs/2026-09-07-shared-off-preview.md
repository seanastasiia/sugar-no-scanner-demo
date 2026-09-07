# Shared Open Food Facts preview acceptance — 7 September 2026

## Candidate and boundary

- Storage implementation: `245cf8927c1b94ae3eaef5f79e843fbb9614eab0`; inline-card fix: `aa00a5228ea22b85d2d689f2d607abff69793e86`; final name-query fix: `df98ff16ec7621bb1a3af50386a743cae2c77226` on `codex/personal-fit-catalog-preview`.
- Scope: exact dynamic Open Food Facts cards, GTIN/name-alias reuse, isolated ODbL persistence, conflict quarantine and barcode fallback.
- Production `main`, production Railway and production Supabase were not changed.
- Retailer-page shared flags remain off. After explicit owner approval, the OFF-only migration and flag were enabled only on isolated staging/preview.

## Technical checks

| Check | Result |
| --- | --- |
| Focused OFF/search/recognition/barcode suite | Pass: 4 files / 57 tests |
| `npm run verify` | Pass: 74 files / 663 tests; catalog validators; Next production build and standalone assets |
| Catalog totals | Pass: 40 curated; 18,554 Barbora identities; 6,822 Rimi; 6 Livin; 1,855 Livinn nutrition rows; 2,489 Livinn identities; 500 + 596 OFF |
| Personal Shelf audit | Pass: 5,150 observations; 1,343 complete + 2,369 provisional; 34 contradictory rows remain neutral |
| `CI=1 E2E_PORT=3012 npm run test:e2e` | Pass: 58/58 Mobile Safari scenarios in 2.1 minutes after the final query fix |
| `git diff --check`, lint, typecheck | Pass |

The first whole-suite run used parallel Vitest workers and three heavy catalog-import tests crossed the five-second test deadline. Each target passed alone; the test configuration now uses one worker because several integration files load the full 20k-record source catalog. The unchanged assertions then passed, and the final suite contains 663 tests. This changes test scheduling, not product behavior or acceptance thresholds.

## Trust and privacy checks

- Exact API barcode responses must return the requested checksum-valid GTIN.
- The first dynamic result is normalized before scoring, so the first and later shared reads keep one ID and one composition.
- Search aliases store only a one-way hash of normalized brand/name/variant/pack/barcode fields; raw scan text, users, sessions and images are not stored.
- A conflicting GTIN alias or changed identity/composition is blocked permanently. Missing fields remain unknown and observations are never stitched together.
- RLS and privileges deny `anon` and `authenticated`; only the server service role can read/promote. Immutable observation rows cannot be updated by the service role.
- OFF records stay in separate attributed `ODbL-1.0` tables. Retailer-page data cannot enter them.

## Live staging acceptance

1. Applied `202609070001_shared_open_food_facts.sql` to staging project `gfvzibdikjexcygmkxpm`. All three tables and the promotion RPC exist; RLS denies browser roles, the service role can read/promote but cannot update history, and anonymous RPC execution is denied.
2. Enabled only `SHARED_OFF_CATALOG_ENABLED=true`; `SHARED_WEB_CATALOG_ENABLED=false` and `SHARED_WEB_SHELF_EVIDENCE_ENABLED=false` remain unchanged.
3. Railway deployments `83a6d4f1-e30c-492b-92a7-a1aaba51a208`, `cf55c278-a661-4c71-bb51-34c1db9d3c0e` and acceptance deployment `830e38ba-c9ca-45ce-9b7b-07f2ec53492c` reached SUCCESS. HTTPS smoke passed on exact revision `d8de384053bba6bbd314ccca66e2c7d14787332b`, with the shared OFF feature on and the retailer flags off.
4. Real barcode `3017620422003`, absent from the checked-in 1,096 OFF records, returned one stable `off:03017620422003` card with 6.3 g protein and 56.3 g sugar; a repeat created no duplicate.
5. Real name-only lookup `Multipower Protein Delight Salty Peanut Caramel 35 g`, also absent from the checked-in layer, returned complete inline card `off:04006643138274` with 34 g protein and 3.7 g sugar in 741 ms. The repeat returned the same card in 518 ms. After a new Railway deployment restarted the process and cleared memory, the same hashed alias returned the persisted card in 469 ms and database counts stayed unchanged. This also exposed and fixed a duplicated `35 g 35 g` search-query regression.
6. Final database read: 2 product cards, 1 one-way alias, 2 accepted immutable observations and 0 conflicts. Both cards retain `Open Food Facts contributors` and `ODbL-1.0`; no image, user or session field is stored.

## Owner product checks

1. Scan a clear product barcode not already bundled, open `View all`, and verify protein/sugar and the Personal Fit result against the package.
2. Repeat the same product in a new browser session; it should return the same card faster.
3. Try a different flavour or pack size; it must not borrow the first product's score.
4. Confirm a missing ingredient/fiber value still appears as unknown/provisional rather than zero.
