# Bugs

This file tracks open limitations and only recent resolved regressions. Older history remains recoverable in Git.

## Open

- **Latvia coverage is not universal.** Private labels, unreadable variants and products without an exact cited per-100 table can remain unresolved. They must not receive a guessed fit.
- **Physical-store accuracy is not validated.** Packaging glare, low light, distance and a moving checkout belt need a real-store benchmark.
- **Shelf-price association needs a benchmark.** Ambiguous labels stay hidden; a package number, deposit or unrelated nearby tag must not become the product price.
- **Rimi/Livin coverage is only a bootstrap.** Their exact page adapters work, but production-scale refresh and reuse require retailer permission.
- **Open Food Facts bulk coverage is only a bootstrap.** The isolated importer is production-shaped; the checked-in layer contains five verified Latvia proof rows.
- **Retailer snapshots age.** Checked-in product and nutrition indexes are reproducible discovery snapshots, not real-time stock or price guarantees.
- **Grounded nutrition can be slow or unavailable.** Identity appears first; exact internet enrichment is background-only and bounded to 18 seconds.
- **Railway config-as-code needs migration before 1 December 2026.** The current `railway.json`/`railway.toml` deployment still works, but Railway now recommends `.railway/railway.ts` and prints a deprecation warning during deploys.

## Recently resolved

- **2026-08-26: removed features and QA artifacts still inflated the active codebase.** The unreachable nutrition-label follow-up was deleted from client, API and server code; camera results and demo fixtures were split into focused modules; Playwright screenshots now stay in ignored test artifacts instead of Git.
- **2026-08-26: nutrition resolution depended on Barbora plus runtime web search.** Strict Rimi and Livin adapters now resolve exact identity, per-100 protein/sugar, page price and provenance; Open Food Facts has a separate ODbL import and Supabase layer.
- **2026-08-26: broad Similar options were not guaranteed substitutes.** The block is now fail-closed Better alternatives: same exact type/subcategory/form, equal or better fit, active exact offer, then price and pack-size tie-breaks.
- **2026-08-26: camera marker colors rendered at inconsistent sizes.** Great, Moderate and Low fit discs share one visual diameter while the package outline remains the touch target.
- **2026-08-26: scanner surfaces had drifted from the shipped Sugar.no app.** The current UI uses the cool gray canvas, white cards, neutral separators, black hierarchy and semantic fit pills from the supplied iOS screens.
- **2026-08-26: price-only and identity-only products remained in final comparison.** A source miss now removes the incomplete row and its price/retailer action rather than inventing a fit.
- **2026-08-25: live Gemini boxes drifted onto shelf labels.** Recognition now uses native normalized box coordinates, tighter package instructions and guarded shelf-label association.
- **2026-08-25: active live-camera work could overwrite Checkout demo.** Source changes abort and ignore stale camera requests before deterministic scenes start.

When a new regression is fixed, add one concise entry here. Put detailed evidence in a test log only for release-critical work.
