# Rimi/Lidl continuation — 10 September 2026

Local candidate; no production publication, Supabase write or Railway deployment. CSP remains excluded. Publication requires the owner's explicit `ПУБЛИКУЙ`.

## Result and provenance

Baseline candidate: `c68075e`; production baseline verified on GitHub main: `61be6f5161e1cd111109d7809338c1afc9ae5b4f`.

The previous vegan slug `vegana-un-vegetara-partika` matched no sitemap section. The actual current section is `veganiem-un-vegetariesiem`; all 87 URLs were fetched, all supplied basic complete nutrition, and all were absent from the prior candidate. A missing configured section now stops ingestion before any snapshot write.

The resumed nine-section pass accounts for 7,729 URLs. It reused 7,472 exact page observations (including the new vegan cohort) and fetched the remaining 257; zero request failures and three not-found pages. This is not a claim that all 7,729 pages were re-fetched today. Prior product verification dates remain unchanged.

- 7,018 complete Rimi rows: +88 versus yesterday, +196 versus production; no prior complete source ID removed.
- 565 Rimi identity-only rows; none has a valid GTIN, 54 have no parseable pack size.
- 105 complete rows absent from the current sitemap stay historical/unavailable without price or currency.
- 33 initially category-matched vegan candidates were checked for whole exact composition: 18 accepted observations, 15 strict parser rejections, zero rate limits and zero unattempted candidates. One rejected dual-unit ice-cream sample still had ambiguous `100g/ml` nutrition and was not forced into a basis.
- Existing composition observations are byte-equivalent after JSON serialization; 18 observations added. Inventory: 7,530 observations, 2,339 complete assessments, 3,426 provisional, 1,765 unscored. Assessable source rows: 5,765 (+5). Category QA found tofu in the vegan `siers` aisle. All ten products in that mixed aisle are now unsupported in Personal Shelf, removing two erroneous tofu assessments before release. Dairy cheese and vegan ice cream retain their existing mappings; formula weights are unchanged.
- Lidl's current sitemap again has 67 URLs. Its official dairy/bakery brand pages and food offer page supplied no additional exact nutrition. Existing one identity-only Pilos row remains; no new Lidl nutrition row or cross-country recipe substitution.

Sources: [Rimi sitemap](https://www.rimi.lv/e-veikals/sitemap.xml), [Lidl sitemap](https://www.lidl.lv/static/sitemap.xml), [Lidl dairy](https://www.lidl.lv/c/piena-produkti/s10024910), [Lidl bakery](https://www.lidl.lv/c/bekereja/s10024895), [Lidl food offers](https://www.lidl.lv/c/edieni-un-dzerieni/s10068374).

Generated reproducible comparison: `data/rimi-lidl-expansion-report.generated.json`. Local raw logs/checkpoints: `.catalog-sync/continuation-2026-09-10/`.

## Technical verification

Tested application/data commit: `5b98f5fe2d2b4ae54d4f2ec984d5a45e962374c0`. The final follow-up changes documentation only.

- Category regression integration tests: 2/2 passed; stale and partly missing scopes both preserve existing output files.
- `npm run supabase:seed:external:dry-run`: passed; no database writes.
- Focused category/scoring tests: 103/103 passed (`focused-tests.log`).
- `npm run verify`: passed; lint, TypeScript, 86 Vitest files / 744 tests, all catalog validators and production build (`verify-final.log`). An earlier verification run was intentionally interrupted when product QA identified the tofu category issue; the final run above supersedes it.
- `CI=1 WTP_PAYWALL_ENABLED=true E2E_PORT=3119 npm run test:e2e`: all 71 Mobile Safari scenarios passed in 2.7 minutes, no retries (`e2e.log`).
- Exact prior-SKU comparison: all 6,930 previous complete rows retained with unchanged basic nutrition; 105 historical records have no price/currency and are unavailable (`integrity.json`).
- `git diff --check`: passed. No deployment claim is made; production smoke belongs to the separately authorized publication step.

## Owner product checks

1. Scan the exact Hellmann's vegan mayonnaise 330 g or Alpro vanilla soy dessert 125 g pack. Exact basic nutrition may support default Fit; do not expect unsupported Personal Shelf categories to receive a score.
2. Scan Avenei coconut/berry ice cream 80 g (Rimi SKU `955679`), then Lunter tofu 180 g (SKU `4000769`): the ice cream may receive Personal Shelf, the tofu must remain unsupported; check the score disclosure against its own source ingredients and per-100 table.
3. Check an incomplete Rimi or Lidl Pilos card: identity alone must not invent nutrition or a score.
4. A historical Rimi card must not show a current store price or availability claim.

## Authorized production release

The owner explicitly requested `ПУБЛИКУЙ` after local candidate acceptance. GitHub and live production were independently verified at `92781e0e22a5dbb40823f4e1236af985e64ff134`; the intervening Meta consent/SDK/mobile-spacing changes were merged without conflicts. Full verification of the merged release is required before push. Catalogs are versioned application snapshots and work without a database migration or import; this release does not run the broad external seed/prune command.

Rollback base: `production-before-rimi-lidl-expansion-2026-09-10`, pointing to `92781e0e22a5dbb40823f4e1236af985e64ff134`. Restore the same production environment and verify health SHA if rollback is needed.
