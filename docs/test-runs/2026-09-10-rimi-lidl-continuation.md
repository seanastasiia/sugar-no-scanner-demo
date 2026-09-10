# Rimi/Lidl continuation — 10 September 2026

Local candidate; no production publication, Supabase write or Railway deployment. CSP remains excluded. Publication requires the owner's explicit `ПУБЛИКУЙ`.

## Result and provenance

Baseline candidate: `c68075e`; production baseline verified on GitHub main: `61be6f5161e1cd111109d7809338c1afc9ae5b4f`.

The previous vegan slug `vegana-un-vegetara-partika` matched no sitemap section. The actual current section is `veganiem-un-vegetariesiem`; all 87 URLs were fetched, all supplied basic complete nutrition, and all were absent from the prior candidate. A missing configured section now stops ingestion before any snapshot write.

The resumed nine-section pass accounts for 7,729 URLs. It reused 7,472 exact page observations (including the new vegan cohort) and fetched the remaining 257; zero request failures and three not-found pages. This is not a claim that all 7,729 pages were re-fetched today. Prior product verification dates remain unchanged.

- 7,018 complete Rimi rows: +88 versus yesterday, +196 versus production; no prior complete source ID removed.
- 565 Rimi identity-only rows; none has a valid GTIN, 54 have no parseable pack size.
- 105 complete rows absent from the current sitemap stay historical/unavailable without price or currency.
- 33 supported-category vegan candidates were checked for whole exact composition: 18 accepted observations, 15 strict parser rejections, zero rate limits and zero unattempted candidates. One rejected dual-unit ice-cream sample still had ambiguous `100g/ml` nutrition and was not forced into a basis.
- Existing composition observations are byte-equivalent after JSON serialization; 18 observations added. Inventory: 7,530 observations, 2,341 complete assessments, 3,426 provisional, 1,763 unscored. Assessable source rows: 5,767 (+7). Formula, supported categories and weights unchanged.
- Lidl's current sitemap again has 67 URLs. Its official dairy/bakery brand pages and food offer page supplied no additional exact nutrition. Existing one identity-only Pilos row remains; no new Lidl nutrition row or cross-country recipe substitution.

Sources: [Rimi sitemap](https://www.rimi.lv/e-veikals/sitemap.xml), [Lidl sitemap](https://www.lidl.lv/static/sitemap.xml), [Lidl dairy](https://www.lidl.lv/c/piena-produkti/s10024910), [Lidl bakery](https://www.lidl.lv/c/bekereja/s10024895), [Lidl food offers](https://www.lidl.lv/c/edieni-un-dzerieni/s10068374).

Generated reproducible comparison: `data/rimi-lidl-expansion-report.generated.json`. Local raw logs/checkpoints: `.catalog-sync/continuation-2026-09-10/`.

## Technical verification

- Category regression integration tests: 2/2 passed; stale and partly missing scopes both preserve existing output files.
- `npm run supabase:seed:external:dry-run`: passed; no database writes.
- Full verification and browser results will be recorded after completion.

## Owner product checks

1. Scan the exact Hellmann's vegan mayonnaise 330 g or Alpro vanilla soy dessert 125 g pack. Exact basic nutrition may support default Fit; do not expect unsupported Personal Shelf categories to receive a score.
2. Scan an exact new vegan product with an accepted Personal Shelf assessment; check the score disclosure against its own source ingredients and per-100 table.
3. Check an incomplete Rimi or Lidl Pilos card: identity alone must not invent nutrition or a score.
4. A historical Rimi card must not show a current store price or availability claim.
