# Internal Personal Shelf research queue — 10 September 2026

Implementation based on `56f87c0`, integrated with `545d2c7` (server Purchase preparation). This report belongs to the queue commit containing it; no production queue activation is claimed.

## Technical evidence

- Initial `npm run verify`: PASS, 91 files / 774 tests, catalogue validators and production build.
- Full Mobile Safari suite with the queue flag enabled: 72 passed, 4 skipped, 2 failed on stale nutrition assertions / contrast during animation. Both failures were corrected in the concurrent main update and independently passed in the queue worktree.
- Queue browser cases: offline save survives reload, verified nutrition appears, real-scan identity submits without image/scan payload, and public root never submits. All three passed.
- Production-mode Meta consent / paid-return regression: 4 passed.
- Exact-source boundary: explicit pilot composition extraction works while global shared Shelf evidence stays disabled; default launch behavior is unchanged.
- Final integrated `npm run verify`: PASS, 96 files / 800 tests, catalogue checks and production build. Includes actual PostgreSQL-engine migration/lease/isolation assertions through PGlite. Final lint: PASS without warnings.
- Final integrated full Mobile Safari suite: 74 passed, 4 skipped (disabled Meta cases; separately tested above).

Local logs: `.catalog-sync/shelf-queue/verify.log`, `e2e.log`, `recheck.log`, `meta.log`, `verify-integrated.log`. No credentials or photos are included in the queue payload or this report.

## Activation boundary

The production Supabase migration and live queue checks require a signed-in Supabase account. Keep `SHELF_RESEARCH_QUEUE_ENABLED=false` until migration `202609100002_shelf_research_queue.sql` and transactional `supabase/tests/shelf_research_queue.sql` succeed on that project. Code publication with the flag disabled is not completion of activation.

## Owner checks after activation

1. Open `/pilot/shelf`, scan a previously unrated product, and open My products.
2. Close/reopen the page: the saved product remains and status advances.
3. Open an Added card: criterion points and nutrition per 100 g remain the approved layout.
4. Correct a Needs your help item inside the product; confirm public `/` has no queue entry.

Known limits: unreadable identities need a barcode or name; missing source nutrition and unsupported composition rules cannot be invented. Browser storage clearing loses access to that browser's list. Photos are not retained, and private pilot results do not promote the public launch catalogue.
