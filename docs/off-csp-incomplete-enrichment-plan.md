# OFF identity, CSP and incomplete-evidence execution plan

Checked: 2026-09-07

This work stays on `codex/personal-fit-catalog-preview` and the isolated Railway preview. Production and `main` require the owner's explicit `ПУБЛИКУЙ` instruction.

## Ordered work

1. **Open Food Facts identity-only import.** Reuse the immutable, version-pinned Latvia/Lithuania/Belarus extraction. Accept only a checksum-valid GTIN, a non-empty brand, an unambiguous source name, a market tag and no source identity-quality flag. Store no nutrition, ingredients, inferred language, score or image in this layer. Keep it separate from the 1,096 nutrition-complete OFF rows.
2. **CSP connection.** Implement the official Latvian daily price-file schema and a server-only, source-separated table. Keep it disabled until CSP supplies the feed and confirms Sugar.no's permitted use. The statutory feed is for a free price-comparison purpose and does not contain nutrition, ingredients or product images; it cannot make a Personal Fit score by itself.
3. **3,605 incomplete rating records.** Freeze the existing queue from the catalog audit, then fetch only the exact product page or exact OFF barcode record through resumable per-source workers. Promote only whole, internally consistent observations. Missing values stay null; redirects, flavour/pack conflicts, rate limits and unavailable pages remain failures. Re-run the audit after each accepted batch.

## Technical acceptance

- identity-only GTINs are valid, unique and do not overlap the nutrition-complete OFF layer;
- generated data matches its immutable extraction metadata and SHA-256 report;
- runtime barcode lookup returns an identity-only card with no score;
- OFF, retailer and CSP data stay in separate Supabase tables with server-role-only access;
- CSP import rejects an unknown schema and remains empty/disabled without an issued source file;
- enrichment is checkpointed, source-rate-limited and cannot overwrite newer or contradictory evidence;
- lint, typecheck, unit/integration tests, catalog validators, production build, Railway deployment and live revision/health all pass.

## Owner checks

1. Scan a newly added OFF barcode and confirm the product name appears without a score.
2. Scan the same item by a readable source-language label and confirm a different flavour or pack is not substituted.
3. After CSP access is issued, compare one exact GTIN across Rimi/Maxima/Lidl and confirm price/store data is visible only in the free comparison surface; no nutrition score appears from CSP alone.
4. After enrichment, compare selected incomplete cards before/after: only exact-source cards gain a Personal Fit result; unresolved cards keep a neutral dash.

## Current measured inputs

- OFF regional extraction: 15,669 rows from 4,535,553 streamed records.
- OFF nutrition-complete layer: 1,096 rows.
- OFF identity-only layer accepted in step 1: 9,626 rows; no duplicate conflicts; no aliases were invented because the preserved CSV does not expose labelled translations.
- Existing Personal Shelf audit queue for step 3: 3,605 supported-type source records without sufficient exact evidence.
- CSP: no source file or credentials have been issued. Code readiness does not count as a connected feed.
