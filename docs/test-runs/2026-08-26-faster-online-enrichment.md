# Faster online nutrition enrichment — 2026-08-26

## Change

- Exact nutrition resolution now runs up to five uncatalogued products independently instead of two sequential waves of three and two.
- Each verified product updates the cards immediately; one lookup reaching its timeout no longer holds the other results.
- The existing order remains unchanged: local/Barbora evidence, Open Food Facts, then cited grounded web search.
- Exact SKU, per-100 basis, source and confidence guards remain unchanged.

## Baseline

- Production commit: `b7b2ec6a76aed6001324b47be0f6ffb8c7dbb0e5`.
- One controlled `POST /api/resolve-products` request used the five Turtle products visible in the reported shelf.
- Result: HTTP `200`, all five products received exact `web_search` nutrition, server latency `20,588 ms`, total request time `21.922 s`.

## Technical verification

Target code commits: `74d6b90afbe109ded1c38e7b3d7280be0623cae5` and `fa5f9c306f87866cd2f7063baffd3329e540b4da`.

- `npx vitest run src/lib/product-enrichment.test.ts src/app/api/resolve-products/route.test.ts src/server/recognition.test.ts` — passed: 3 files / 28 tests.
- `npm run check:fast` before the progressive UI pass — passed: lint, typecheck, 25 files / 137 tests.
- `npm run verify` after the progressive UI pass — passed: lint, typecheck, 26 files / 139 tests, production build.
- `CI=1 npm run test:e2e` — passed: 25 Mobile Safari acceptance tests; command exited `0`.
- The dedicated Mobile Safari regression test holds one enrichment request open and confirms another product receives its fit without waiting.
- `GET /api/health` before release — HTTP `200`, service `ok`, commit matched the baseline above.

One production-config local benchmark of the five-product route completed in `18.447 s`; four products resolved while one Google Search request reached its 18-second deadline. That tail result is why the client now applies each response independently instead of presenting route completion time as the user-perceived wait.

## Product checks

1. Scan a shelf containing five products absent from the local catalog.
2. Confirm that identity cards remain visible while exact nutrition is checked.
3. Confirm that completed exact results appear one by one rather than waiting for the slowest item or a second `3 + 2` queue.
4. Repeat the same scan and confirm that successful exact web results reuse the running-service cache.
5. Scan an ambiguous flavor or pack size and confirm that the app still refuses to invent a fit.

## Release verification

Pending GitHub device confirmation, Railway deployment and a production rerun of the same five-product Turtle request.
