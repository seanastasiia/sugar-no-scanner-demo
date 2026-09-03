# Shared page-checked web catalog, 3 September 2026

Application revision: `15733072523e57cfc43e84723bb8a608cc7589dc` (base production `45b736f0722c8a64bf31c9cf5b2ee5525ff84e41`). Documentation-only release commits may follow without changing the tested application.

## Technical evidence

- `npm run verify`: PASS, 49 Vitest files / 298 tests, ESLint, TypeScript, catalog validators and production build. Full output: `/tmp/sugar-no-shared-web-qa.yOyOH8/verify-final.log`.
- `CI=1 E2E_PRODUCTION=0 SHARED_WEB_CATALOG_ENABLED=true npm run test:e2e`: PASS, 31/31 Mobile Safari scenarios on the final application revision, 1.2 minutes. Output: `/tmp/sugar-no-shared-web-qa.yOyOH8/e2e-final.log`.
- Nine isolated PostgreSQL migration/transaction tests cover service-role operation, idempotence, proven aliases, null versus zero, conflict quarantine, basis conflicts, incompatible partial tables, alias ownership and role/immutable-history permissions. No synthetic fixture was committed to Supabase.
- Server integration tests inject deliberately false model nutrients (90 g protein / 99 g sugar) and confirm only actual page values (7.2 g / 24 g) enter the shared row. A fresh module instance reuses the card without Google. Missing data stays unrated; wrong variants, missing storage confirmation and identity conflicts are withheld.
- Six live, read-only source probes identified all six exact products. Livinn `03000000442` and `03000000478`, and Rimi `100006` and `100007` yielded explicit per-100 nutrition. Livin Latvia `03000005612` and `03000011207` remained identity-only because the strict parser found no supported evidence; no older/model values filled those gaps. Output: `/tmp/sugar-no-shared-web-qa.yOyOH8/live-source-readback.log`. This small sample is not a market-wide coverage estimate.
- Applied the additive migration `202609030001_shared_web_products.sql` through the Supabase SQL Editor in the existing scanner project. Live readback confirms RLS on all three tables, no anon reads or authenticated inserts, service-role-only function execution, and no service-role update privilege on immutable observations. All three tables initially have zero rows; SDK joins work and an invalid promotion is rejected before any write. Output: `/tmp/sugar-no-shared-web-qa.yOyOH8/supabase-readback.log`.
- An initial optional production-mode Safari run on plain local HTTP was interrupted after tracing API 401s to Secure cookies. Production security was not weakened. The supported development-mode browser suite is used above; the real production HTTPS host receives separate authenticated smoke checks. Diagnostic trace: `/tmp/sugar-no-shared-web-qa.yOyOH8/production-http-cookie.trace.zip`.

## Release procedure and owner check

Enable only after the migration, push the tested source to GitHub main and publish through the existing Railway production service. Confirm terminal deployment success and `/api/health` SHA agreement plus `features.sharedWebCatalog=true`; smoke direct entry/session, bare API 401, cross-origin 403, exact barcode, retained Livinn quarantine and four-product Shelf demo with `imageStored=false`. Production outcomes are recorded in the dated shared Sugar.no update after deployment, not preclaimed here.

Owner: scan a new exact SKU, check its source, repeat in a second session/device, then try a different pack/flavour and a product with missing nutrition. Expect the same shared card for the proven identity, no cross-variant borrowing and honest unknowns. Only supported reviewed source pages are eligible; no bulk backfill, UI change or Personal Shelf Rank rollout is included.
