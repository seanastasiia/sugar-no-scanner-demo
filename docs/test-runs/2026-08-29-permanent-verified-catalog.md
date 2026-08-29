# Permanent verified catalog release evidence

- Date: 2026-08-29
- Tested code commit: `962cf32c8f6dd9280f9ab9d49bacdb032f4db5d9`
- Scope: keep only 7,433 nutrition-complete Barbora SKUs in Supabase; retain verified nutrition permanently; schedule silent source-specific revalidation; preserve immutable versions and the last successful result.

## Technical verification

- `npm run verify` — passed.
  - ESLint passed.
  - TypeScript passed.
  - Vitest: 42 files, 214 tests passed.
  - Next.js production build passed.
- `CI=1 npm run test:e2e` — Mobile Safari: 28 tests passed.
- `npm run supabase:seed:external:dry-run` — exactly 7,433 Barbora current rows, all 7,433 nutrition complete, no unverified price rows.
- `railway run npm run supabase:verify:external` — live Supabase contains 7,433 current Barbora rows, 7,433 nutrition-complete rows and 7,433 immutable version rows; 0 rows were already due for silent revalidation.
- `git diff --check` — passed.

## Product verification

1. Scan a previously resolved exact SKU and confirm its Sugar.no fit appears without waiting for a new web search.
2. Confirm a Barbora item without both protein and total sugar is not presented as rated.
3. Confirm a verified item remains available after its freshness date while its refresh runs silently.
4. Confirm a failed refresh does not remove or replace the last verified fit.

The broader checked-in Barbora discovery indexes remain available only for visual identity matching. They are not imported into the operational Supabase catalog and do not imply a Sugar.no fit.
