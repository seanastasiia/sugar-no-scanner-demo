# Saved Shelf recall production release — 16 September 2026

## Result

Repeat pilot scans now reuse a verified product already saved for the same browser owner when the observed identity is exact. Matching accepts the same source ID, verified GTIN, or complete brand, name, variant and pack identity with case and whitespace normalization. Conflicting barcodes, variants, pack sizes, ambiguous saved records, weak detections and ineligible nutrition remain unmatched. A recalled product is removed from new queue submissions.

Implementation commit: `a4d0a5b2a24c94a50d61b0654fc923f10825cdb2`.

## Technical verification

- `git diff --check`: passed.
- Focused saved-match and queue tests: 31/31 passed.
- `npm run verify`: passed with 97 files / 814 tests, TypeScript, catalog validation and the production build. ESLint retained one pre-existing non-blocking hook-dependency warning in `scanner-app.tsx`.
- The first full run exposed an expired fixed date in the existing billing SQL test. Its valid-token fixture was moved to 2099; the billing implementation was unchanged. The isolated billing file then passed 4/4 and the full verification passed.
- `SHELF_RESEARCH_QUEUE_ENABLED=true CI=1 WTP_PAYWALL_ENABLED=true E2E_PORT=3012 npm run test:e2e -- --workers=1`: 77 passed, four expected Meta-only tests skipped.
- Railway deployment `53fa3412-aaa3-4055-9cfa-6b51494a0fd0`: `SUCCESS`.
- Production `/api/health`: HTTP 200, `status=ok`, exact implementation commit, queue enabled and expected catalog counts.
- Production root and Personal Shelf demo: HTTP 200. Root issued the secure HTTP-only session cookie.
- Bare recognition request: HTTP 401. Authenticated deterministic Shelf recognition: HTTP 200, four detections and `imageStored=false`.

## Owner product check

1. Open `/pilot/shelf` in the same browser previously used for a saved product.
2. Re-scan the same product with the same variant and pack size, even if OCR casing or spacing changes.
3. Open `View all` and then `Why this score`; confirm the saved nutrition appears without another queue entry.
4. Scan a different pack size or flavour and confirm it is not given the saved product's result.

This improves repeat use after a product has already been verified. It does not create a trained visual index, share saved results between browsers, or identify similar products by name alone.

Rollback: deploy tag `production-before-saved-shelf-recall-2026-09-16` at `34674fd16c0c5493583622c5ff1731a79888b3e9`.
