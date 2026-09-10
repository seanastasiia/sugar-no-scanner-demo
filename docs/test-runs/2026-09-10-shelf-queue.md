# Internal Personal Shelf research queue — 10 September 2026

Implementation based on `56f87c0`, integrated with `545d2c7` (server Purchase preparation). This report belongs to the queue commit containing it; initial publication kept the queue disabled; the live activation follow-up is recorded below.

## Technical evidence

- Initial `npm run verify`: PASS, 91 files / 774 tests, catalogue validators and production build.
- Full Mobile Safari suite with the queue flag enabled: 72 passed, 4 skipped, 2 failed on stale nutrition assertions / contrast during animation. Both failures were corrected in the concurrent main update and independently passed in the queue worktree.
- Queue browser cases: offline save survives reload, verified nutrition appears, real-scan identity submits without image/scan payload, and public root never submits. All three passed.
- Production-mode Meta consent / paid-return regression: 4 passed.
- Exact-source boundary: explicit pilot composition extraction works while global shared Shelf evidence stays disabled; default launch behavior is unchanged.
- Final integrated `npm run verify`: PASS, 96 files / 800 tests, catalogue checks and production build. Includes actual PostgreSQL-engine migration/lease/isolation assertions through PGlite. Final lint: PASS without warnings.
- Final integrated full Mobile Safari suite: 74 passed, 4 skipped (disabled Meta cases; separately tested above).

Local logs: `.catalog-sync/shelf-queue/verify.log`, `e2e.log`, `recheck.log`, `meta.log`, `verify-integrated.log`. No credentials or photos are included in the queue payload or this report.

## Initial activation boundary (resolved below)

The production Supabase migration and live queue checks require a signed-in Supabase account. Keep `SHELF_RESEARCH_QUEUE_ENABLED=false` until migration `202609100002_shelf_research_queue.sql` and transactional `supabase/tests/shelf_research_queue.sql` succeed on that project. Code publication with the flag disabled is not completion of activation.

## Owner checks after activation

1. Open `/pilot/shelf`, scan a previously unrated product, and open My products.
2. Close/reopen the page: the saved product remains and status advances.
3. Open an Added card: criterion points and nutrition per 100 g remain the approved layout.
4. Correct a Needs your help item inside the product; confirm public `/` has no queue entry.

Known limits: unreadable identities need a barcode or name; missing source nutrition and unsupported composition rules cannot be invented. Browser storage clearing loses access to that browser's list. Photos are not retained, and private pilot results do not promote the public launch catalogue.

## Production activation, 10 September 2026

Owner signed in to Supabase. Applied `202609100002_shelf_research_queue.sql` in project `gkivwusbobnwzrisbkle` SQL Editor. Live transaction assertions passed (idempotent enqueue, owner receipts, denied browser roles, single lease and expired lease recovery); rollback left zero fixture rows. Both tables show RLS true, anon/authenticated SELECT false, service_role SELECT true.

Activation deployment `4057581f-7dca-4f65-8f1c-b75bcbbc7231` SUCCESS on `1484145`; health matches and queue flag true. Real browser GO Pure CLASSIC 125 g submission with a Livinn source reached ready in one attempt, remained after reload, and displayed 64 points plus 0.6 g sugar / 5 g protein / 1.03 g salt / 2.6 g saturated fat / 5.3 g fiber / 485 kcal per 100 g. A fresh random owner key returned 200 with no items; launch root remains 200 without My products.

A live source-free Santa Maria lookup exposed a retired hardcoded model (provider 404). The following repair honors the application's configured current model and adds a regression test. Final verification and reprocessing are recorded in the activation handoff.

Repair verification: `npm run verify` PASS (96 files, 801 tests, catalogue validation and production build); queue Mobile Safari suite 3 passed. Live provider call using the existing configured model found an exact Santa Maria source and returned review for unsupported type/basis instead of provider failure. No score was fabricated. Logs: `.catalog-sync/shelf-queue/verify-activation.log`, `e2e-activation.log`.
