# Bugs

This file tracks open limitations and only the most recent resolved regressions. Older resolved history remains recoverable in Git and in the dated test evidence.

## Open

- **Latvia coverage is not universal.** Rimi, Lidl and Stockmann private labels, unreadable variants and products without an exact cited per-100 table can remain `Nutrition not verified online`. They must not receive a guessed fit.
- **Physical-store accuracy is not validated.** Packaging glare, low light, distance and a moving checkout belt need a real-store benchmark.
- **Shelf-price association needs a benchmark.** Ambiguous labels stay hidden; a package number, deposit or unrelated nearby tag must not become the product price.
- **Only Barbora is connected.** The demo may say `Barbora online`, but cannot claim `best price` without comparable exact-SKU data from multiple retailers.
- **Retailer snapshots age.** The checked-in product and nutrition indexes are reproducible discovery snapshots, not real-time stock or price guarantees.
- **Grounded nutrition can be slow or unavailable.** Identity appears first; the exact internet check is background-only and bounded to 18 seconds.

## Recently resolved

- **2026-08-26: Similar options shared one ambiguous Barbora CTA and showed no per-card price.** Every exact Barbora alternative now has its own non-blocking `Buy online` action and current price; `Cheaper online` is reserved for the same SKU with a higher scanned shelf price.
- **2026-08-26: price-only and identity-only products remained in the final list as incomplete results.** Unresolved identities now disappear when the exact nutrition lookup finishes; a shelf price or retailer offer is shown only alongside a source-backed Sugar.no fit.
- **2026-08-25: live Gemini boxes could drift onto shelf labels and Latvian prices without a readable `€` were always discarded.** Recognition now uses Gemini's native 0-1000 `box2d` convention with tight-package instructions, higher live-frame resolution and guarded comma-decimal shelf prices.
- **2026-08-25: expanded multi-product results repeated scan counts, instructions and a second scan-again action above the ranking.** The expanded view now keeps only the collapse control, `Best fit first` and the ranked product cards before contextual price or alternative actions.
- **2026-08-25: the demo chooser included a redundant investor-coverage card above its actions.** The card is removed so the three demo actions begin directly under the heading.
- **2026-08-25: the expanded comparison control used an upward chevron that conflicted with the intended navigation cue.** The control now shows a downward chevron while keeping the same collapse action and accessible label.
- **2026-08-25: expanded multi-product results repeated the leading rating in a large `Best fit in this scan` block.** The ranked list is now the single comparison source; similar options and price actions remain directly below it.
- **2026-08-25: four decorative camera corners implied that only the center rectangle was analyzed.** The guide is removed from live camera and saved-photo views; recognition still reads the full scene and keeps real product boxes after detection.
- **2026-08-25: dense scans looked mostly broken when eight identities produced only two fits.** Results are now capped at five distinct high-confidence SKUs. Missing nutrition is checked through exact local, retailer, Open Food Facts and cited web sources; the nutrition-label scan action was removed.
- **2026-08-25: a cold grounded lookup could hit the original 12-second timeout.** The background bound is now 18 seconds, duplicate query terms are removed and the first identity result remains non-blocking.
- **2026-08-25: the rejected Pen/Figma theme reached production.** Production was restored to the accepted pre-Pen visual system. The obsolete experiment is removed from the active tree and remains recoverable in Git.
- **2026-08-25: active live-camera requests could leave Checkout demo on a preloader.** Source changes now abort and ignore stale camera work before a deterministic demo starts.
- **2026-08-25: long retailer screenshots lost readable products.** Saved portrait images run one full read plus three overlapping sections, remap boxes and merge exact products.
- **2026-08-25: iPhone viewport changes clipped the camera or result sheet.** The scanner uses live viewport edges and safe-area insets, with acceptance coverage for iPhone 17 Pro portrait and landscape.

When a new regression is fixed, add one concise entry here and put detailed evidence in a test log only if the change is release-critical.
