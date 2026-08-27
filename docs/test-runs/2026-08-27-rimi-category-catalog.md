# Rimi category catalog and Livin accounting — 27 August 2026

## Scope

- Import only the seven user-approved Rimi Latvia sections: meat/fish/prepared food, dairy/eggs, bakery, frozen food, packaged food, sweets/snacks and drinks.
- Keep Livin as a small secondary source by accounting for its complete Latvia product sitemap.
- Accept a rated product only when exact identity, energy, protein and total sugar are present on the source page.
- Make full configured-scope imports resumable, rate-bounded and auditable without calling Gemini.

Validated product commit: `bc9e42503c1e6c24e3efa8ccbcb3b921b63dedde`.

## Import evidence

| Source | Discovered / processed URLs | Complete rated products | Incomplete skipped | 404/410 | Failed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Rimi selected categories | 7,617 / 7,617 | 6,822 | 792 | 3 | 0 |
| Livin Latvia sitemap | 169 / 169 | 6 | 163 | 0 | 0 |

Rimi complete products by top-level category:

| Category | Products |
| --- | ---: |
| Packaged food | 2,119 |
| Sweets and snacks | 1,254 |
| Meat, fish and prepared food | 906 |
| Dairy products and eggs | 944 |
| Drinks | 638 |
| Bakery | 481 |
| Frozen food | 480 |

All 6,822 retained Rimi rows have a source URL, product image, current page price, energy, protein and total sugar. Availability is a source-page observation, not a stock guarantee. Rimi's current page parser does not expose GTIN, so exact matching remains identity-based. The importer did not call Gemini and consumed no Gemini tokens.

## Technical checks

| Check | Result |
| --- | --- |
| `npm ci` | Pass; clean dependency install, 0 vulnerabilities |
| `npm run catalog:validate` | Pass; Rimi 6,822 / 7,617 configured pages, Livin 6 / 169 pages, no failed URLs |
| Parser unit test | Pass; 4/4 |
| External catalog tests | Pass; 6/6 across two files |
| `npm run verify` | Pass; ESLint, TypeScript, 29 test files / 153 tests and Next.js 16 production build |
| `CI=1 npm run test:e2e` | Pass; 25/25 Mobile Safari scenarios in 53.1 seconds |
| `git diff --check` | Pass |

Intermittent `ECONNRESET` messages from the local Playwright web server occurred only after browser requests were intentionally aborted; all 25 scenarios passed and the process exited successfully.

### Bilingual Rimi identity follow-up

The reported Rimi packages were present in the snapshot but their visible English names did not overlap with the Latvian retailer titles. The matcher now normalizes only the audited phrase pairs and uses balanced two-way token coverage, exact pack size, brand and a minimum top-candidate margin.

| Visible package identity | Local Rimi match | Confidence / next-candidate gap |
| --- | --- | ---: |
| `Pastry twists SALTY 125g` | `Sālsstandziņas Rimi 125g` | 1.000 / 0.104 |
| `Pastry twists CHEESE 125g` | `Sālsstandziņas Rimi ar sieru 125g` | 1.000 / 0.104 |
| `Sulu dzēriens multi fruit 200ml` | `Sulas dzēriens Rimi multiaugļu 200ml` | 1.000 / 0.130 |
| `Sulu dzēriens strawberry banana 200ml` | `Sulas dzēriens Rimi Banānu un zemeņu 200ml` | 1.000 / 0.142 |

Targeted external-catalog and recognition tests pass 28/28. The pipeline assertion verifies that these matches skip both Open Food Facts and grounded web nutrition. A generic `Juice drink 200ml` stays below the required uniqueness margin and is not guessed.

Pending-state copy now says `Matching product` because this stage starts with the checked-in Sugar.no and retailer snapshots. The UI no longer claims every enrichment request is an online nutrition search.

## Product check

1. Open production in iPhone Safari and scan one exact packaged product from each approved Rimi category.
2. Confirm supported matches show a product image, protein, total sugar and Sugar.no fit; missing nutrition must never be invented.
3. Open a matched product and confirm its Rimi action leads to the exact source page and treats price as a current-page observation.
4. Scan a product outside the seven Rimi sections; confirm the app may still resolve it through Barbora, Open Food Facts or grounded web enrichment, but does not imply Rimi coverage.
5. Scan a Livin food item; only the six exact nutrition-complete Livin pages are currently guaranteed by this source layer.

## Known infrastructure boundary

Production Supabase credentials are not configured in Railway, so the investor demo reads these reproducible checked-in snapshots. The schema and seed tooling remain ready for a future managed refresh after credentials and retailer reuse permission are available.
