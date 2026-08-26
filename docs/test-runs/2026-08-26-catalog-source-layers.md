# Catalog source layers release check — 2026-08-26

Implementation commit: `b8d8cdd134f2324b761212e96f6245d2823632f2`

## Scope

- Add strict Rimi and Livin product-page adapters and reproducible snapshot syncs.
- Add an isolated Open Food Facts ODbL bulk importer and storage layer.
- Put Rimi/Livin before Open Food Facts and cited web lookup in image-free enrichment.
- Add reproducible Supabase migration and seed tooling.
- Record FatSecret Premier, NIQ Brandbank and GS1 Latvia evaluation drafts without sending them.

## Technical checks

- `npm run verify`: **passed**
  - ESLint passed.
  - TypeScript passed.
  - Vitest: 29 files, 150 tests passed.
  - Next.js production build passed.
- `CI=1 npm run test:e2e`: **passed** — 25 Mobile Safari scenarios.
- Live low-rate sync smoke:
  - Rimi: 3 complete rows with identity, energy, protein, total sugar and page provenance.
  - Livin: 2 complete rows; all-zero placeholder GTIN is rejected.
- Open Food Facts importer smoke: 5 Latvia-tagged GTIN rows written through the streaming bulk path to the isolated layer.
- `git diff --check`: **passed**.

The first `npm run verify` exposed two test expectation gaps for the new `retailer_catalog` identity kind. Both were corrected before the successful full run.

## Data/deployment limits

- The official Open Food Facts daily JSONL is larger than 5 GB. This release proves the streaming importer with a small authentic Latvia subset; it does not claim that the entire daily dump is already loaded.
- Railway has no `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` configured for this service, so the migration and seed are checked in but were not applied to a remote Supabase project in this release.
- Rimi/Livin recurring production ingestion remains conditional on provider permission.
- FatSecret, NIQ and GS1 requests remain drafts pending Anastasiia's approval.

## Product checks

1. Scan an exact product from the checked-in Rimi or Livin bootstrap and confirm it receives a source-backed fit rather than a web-estimated one.
2. If a current exact retailer price is present, confirm the retailer name is Rimi or Livin and the link opens that exact product page.
3. Scan a neighboring flavor or different pack size and confirm it does not borrow the bootstrap SKU's nutrition or offer.
4. Open `/api/health` and confirm `connectedRetailerProducts` and `openFoodFactsBulkProducts` are present.
5. Confirm the investor demo still completes Shelf and Checkout scenes without external credentials.

## Production evidence

- GitHub `main`: `90d6f9d4315f194bf7309aac22b7c364dceac208` verified through the connected GitHub account.
- Railway deployment: `75d6636a-6e54-48f0-b616-857694dce5e3` — **SUCCESS**.
- Public root: HTTP 200.
- Public `/api/health`: `status: ok`, deployed commit `90d6f9d4315f194bf7309aac22b7c364dceac208`, Rimi 3, Livin 2, OFF bulk 5.
