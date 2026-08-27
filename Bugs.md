# Bugs

This file tracks open limitations and only recent resolved regressions. Older history remains recoverable in Git.

## Open

- **Latvia coverage is not universal.** Private labels, unreadable variants and products without an exact cited per-100 table can remain unresolved. They must not receive a guessed fit.
- **Physical-store accuracy is not validated.** Packaging glare, low light, distance and a moving checkout belt need a real-store benchmark.
- **Shelf-price association needs a benchmark.** Ambiguous labels stay hidden; a package number, deposit or unrelated nearby tag must not become the product price.
- **Rimi/Livin snapshots are not market-wide.** Rimi is intentionally limited to seven selected food and drink categories (6,822 complete rows from 7,617 pages); Livin contributes 6 complete rows. Recurring production reuse still requires retailer permission.
- **Open Food Facts is incomplete and community-maintained.** The isolated checked-in layer contains 500 complete Latvia-tagged records; a scheduled full bulk import and quality review are still needed for production.
- **Retailer snapshots age.** Checked-in product and nutrition indexes are reproducible discovery snapshots, not real-time stock or price guarantees.
- **Grounded nutrition can be slow or unavailable.** Identity appears first; exact internet enrichment is background-only and bounded to 18 seconds.
- **Railway config-as-code needs migration before 1 December 2026.** The current `railway.json`/`railway.toml` deployment still works, but Railway now recommends `.railway/railway.ts` and prints a deprecation warning during deploys.

## Recently resolved

- **2026-08-27: English Rimi private-label text missed the Latvian snapshot.** Audited bilingual identity normalization now links the four reported pastry-twist and juice variants locally using brand, exact pack size and a uniqueness margin; generic ambiguous juice labels remain unresolved. Pending UI copy now says `Matching product` instead of implying every lookup is online.
- **2026-08-27: Rimi coverage was limited to a 500-row bootstrap.** A resumable category-scoped sync now accounts for every URL in the seven approved Rimi sections and retains 6,822 exact products with source-backed energy, protein and total sugar; Livin's entire Latvia sitemap is also accounted for.
- **2026-08-27: camera/results UI retained unfinished five-product and price-comparison behavior.** The scan cap is ten, camera framing no longer forces a zoomed 16:9 crop, result-status/Best overlays are visually removed, missing packshots fall back to the scanned package crop, and exact online actions live inside their own product cards.
- **2026-08-27: external catalog snapshots were still 3/2/5 proof rows.** Reproducible syncs now cover the approved Rimi scope, all 6 complete Livin food pages discoverable in its public sitemap, and 500 complete Latvia-tagged Open Food Facts records in the isolated ODbL layer.

- **2026-08-26: removed features and QA artifacts still inflated the active codebase.** The unreachable nutrition-label follow-up was deleted from client, API and server code; camera results and demo fixtures were split into focused modules; Playwright screenshots now stay in ignored test artifacts instead of Git.
- **2026-08-26: nutrition resolution depended on Barbora plus runtime web search.** Strict Rimi and Livin adapters now resolve exact identity, per-100 protein/sugar, page price and provenance; Open Food Facts has a separate ODbL import and Supabase layer.
- **2026-08-26: broad Similar options were not guaranteed substitutes.** The block is now fail-closed Better alternatives: same exact type/subcategory/form, equal or better fit, active exact offer, then price and pack-size tie-breaks.
- **2026-08-26: camera marker colors rendered at inconsistent sizes.** Great, Moderate and Low fit discs share one visual diameter while the package outline remains the touch target.
- **2026-08-26: scanner surfaces had drifted from the shipped Sugar.no app.** The current UI uses the cool gray canvas, white cards, neutral separators, black hierarchy and semantic fit pills from the supplied iOS screens.
- **2026-08-26: price-only and identity-only products remained in final comparison.** A source miss now removes the incomplete row and its price/retailer action rather than inventing a fit.
- **2026-08-25: live Gemini boxes drifted onto shelf labels.** Recognition now uses native normalized box coordinates, tighter package instructions and guarded shelf-label association.
- **2026-08-25: active live-camera work could overwrite Checkout demo.** Source changes abort and ignore stale camera requests before deterministic scenes start.

When a new regression is fixed, add one concise entry here. Put detailed evidence in a test log only for release-critical work.
