# Rimi and Lidl Latvia catalog expansion — 9 September 2026

## Scope

This local release candidate implements the approved Rimi refresh, keeps exact incomplete Rimi identities, runs the bounded Lidl Latvia public-page pilot and records the go/no-go decision for a wider Lidl import. The CSP application/import lane is explicitly excluded.

Baseline revision: `61be6f5161e1cd111109d7809338c1afc9ae5b4f`.

No GitHub push, Railway deployment, Supabase write or production publication was performed. Publication remains behind the explicit `ПУБЛИКУЙ` gate.

## Data result

- Rimi: all 7,597 URLs in the nine configured food sections were processed; 6,779 currently listed pages have complete nutrition, 564 current pages remain identity-only, seven URLs were not found and there were no request failures.
- The refresh discovered 108 new nutrition-complete Rimi products.
- 151 previously verified Rimi products that disappeared from the current sitemap are retained as historical and unavailable. Their price and currency are cleared and their original nutrition verification date is preserved. They must not be presented as current offers.
- The resulting complete Rimi layer contains 6,930 rows. The exact Rimi identity base grows from 6,822 to 7,494 rows: +672.
- Lidl: all 67 URLs in the official current product sitemap were processed. One page was classified as food and retained as an identity-only Pilos cheese record; it exposes no GTIN or complete nutrition. The other 66 pages are non-food or unclassified. No nutrition-complete Lidl row was created.
- Combined exact Rimi/Lidl retailer identity growth: +673 rows.
- Full Lidl import through this sitemap is not recommended because it cannot supply rated products or the requested 100-food-card sample.
- Personal Shelf remains at 5,760 assessable rows. Its formula and evidence rules are unchanged. The 24 newly visible `gatavots-rimi` complete products are outside the current 19 supported Personal Shelf types, so no score is invented.

The reproducible comparison is checked in as `data/rimi-lidl-expansion-report.generated.json`.

## Technical checks

All checks below ran on the candidate working tree based on the baseline revision above.

| Check | Result |
| --- | --- |
| Targeted parser and retailer-identity SQL tests | 14/14 passed |
| Parser, SQL, external-catalog and retailer-image-host tests | 35/35 passed |
| `npm run supabase:seed:external:dry-run` | Passed; Rimi 564, Lidl 1, Livinn 2,489 and OFF 9,626 identity rows accounted for without writes |
| `npm run catalog:validate` | Passed |
| `npm run verify` | Passed: lint, typecheck, 85 test files / 741 tests, catalog checks, Personal Shelf evidence validation and production build |
| Full `CI=1 npm run test:e2e` | 63 passed, one scanner case passed on retry, seven paywall-only cases failed because the paywall UI is disabled in the current default mode |
| Focused scanner/Personal Shelf/launch rerun | 6/6 passed, including the previously retried scanner case |
| `git diff --check` | Passed |

The paywall failures wait for dialogs and allowance badges that are intentionally absent when the willingness-to-pay experiment is disabled. No paywall code or assertions were changed in this catalog task.

## Product checks for the owner

1. Scan one of the 108 newly added, currently listed Rimi products with a readable front label. It may receive the original Sugar + Protein Fit when identity matching is exact.
2. Scan a current Rimi product whose page has no complete nutrition. Recognition may retain its exact identity, but it must remain unrated until verified nutrition is available.
3. Scan the Lidl Pilos Salami cheese slices XXL 800 g page/pack. It may be identified, but must not receive invented nutrition or a Personal Shelf score.
4. If a historical Rimi product is recognized from its old verified page evidence, confirm that no current Rimi price or availability claim is shown.

## Known limitations

- None of the 564 Rimi identity-only pages exposes a valid GTIN; 54 also lack a parseable pack size. They cannot be safely joined to OFF by barcode.
- Retailer page observations are not a redistributable public database. Recurring production use still needs retailer permission or an approved structured provider.
- A broader useful Lidl import needs a permitted structured feed or exact package/page evidence containing nutrition; the current official sitemap is not enough.
