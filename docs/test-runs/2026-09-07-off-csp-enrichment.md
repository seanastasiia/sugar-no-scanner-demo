# OFF identity, CSP adapter and incomplete-card enrichment — preview QA

Checked: 2026-09-08

## Scope and release boundary

- Branch: `codex/personal-fit-catalog-preview`.
- OFF identity-only import: 9,626 checksum-valid, attributed records with no nutrition, ingredients, score or invented translation.
- CSP: strict official CSV adapter, private staging tables and default-empty generated layer. It remains disconnected because no issued file or permitted-use confirmation exists.
- Frozen incomplete queue: all 3,605 source/SKU records are accounted for through 3,600 terminal fetch attempts and 5 pre-existing exact observations. The final 591-card Barbora cohort resumed only after the recorded cooldown and ended with 544 accepted observations, 27 changed-SKU rejections and 20 HTTP 404 rejections. No rate-limited or unattempted row remains.
- Production and `main` are outside this release and remain unchanged; the final SHA check is recorded below.

## Data result

- Before: 5,150 exact observations; 1,343 complete scores; 2,369 provisional ranges; 3,712 assessable catalog rows.
- After completed pass: 7,493 exact observations; 2,238 complete scores; 3,371 provisional ranges; 5,609 assessable catalog rows.
- Net: +2,343 observations and +1,897 assessable source rows.
- A before/after scorer comparison found 0 removed observations and 0 changed rating outcomes among all 5,150 previous observations.
- The catalog audit accounts for all 20,120 source rows: 5,609 assessable, 1,700 supported but still missing sufficient exact evidence, and 12,811 outside the 19-type model.
- Contradictory tables remain identifiable and unscored. Missing fields remain null; no cross-source field stitching or flavour/pack borrowing was added.

## Technical checks

- `npm run verify`: passed.
  - ESLint: passed.
  - TypeScript: passed.
  - Vitest: 75 files, 670 tests passed.
  - Catalog validation: OFF identity-only 9,626; CSP 0/0 and disconnected; all generated sources valid.
  - Personal Shelf validation: 7,493 observations; 2,238 complete; 3,371 provisional.
  - Next.js production build and standalone preparation: passed.
- `python3 scripts/test_off_tsv.py`: 3 tests passed.
- `npm run catalog:audit:personal-fit -- --write`: passed with 20,120 distinct source IDs, no evidence outside inventory and no duplicate source/evidence IDs.
- `npm run catalog:report:personal-fit`: passed; calibration alerts remain visible rather than normalized away.
- Frozen-queue resume dry run: 0 runnable jobs, no source cooldown. The post-boundary cohort contains 591 unique terminal attempts: 544 successful, 27 `Exact SKU changed`, 20 HTTP 404, and no 429/403/503.
- HEAD evidence comparison: retailer observations grew from 6,274 to 6,818 through 544 additions; 0 removed and 0 existing observations changed. Personal Fit source/formula files have no diff.
- Staging migration `202609030002_personal_shelf_evidence.sql` was applied idempotently after the first seed correctly failed before writes with missing RPC `PGRST202`.
- `railway run npm run supabase:seed:shelf-pilot -- --apply`: passed with per-batch upsert/read-back and no deletes.
- `railway run npm run supabase:verify:external`: passed. Staging counts match generated files: retailer evidence 6,818; OFF evidence 675; OFF identities 9,626; Livinn identities 2,489; CSP prices/identities 0/0.

## Railway and live HTTPS

- CSP readiness deployment `0df7bca9-b7b5-4fba-839d-2607afae3494`: **SUCCESS**, commit `ff4f3b804ff0a24a2d62502e324958646054803f`.
- Enrichment deployment `3b6be7fc-a3e0-4f3d-909a-df4b94c3d5c8`: **SUCCESS**, commit `66863723ec4d6ebc6ce86617851c37f39e0c067c`.
- Live `/api/health`: `status=ok`, exact commit match, OFF identity-only 9,626, CSP identities 0, Personal Shelf 6,949 / 2,078 / 3,078 / 1,793.
- `PREVIEW_EXPECTED_COMMIT=66863723ec4d6ebc6ce86617851c37f39e0c067c npx tsx scripts/check-personal-fit-preview.ts`: passed on iPhone 13 WebKit emulation. It checked the demo, ordinary sample shelf, checkout sample, Personal Shelf API, exact deployed evidence and OFF 100 g/100 ml barcode paths.

## Owner product checks

1. Open the isolated preview and run `Try a sample shelf` → `View all` → enable `Personal Shelf Rank`; confirm ranked cards render and disabling the toggle restores original Fit.
2. Scan a readable product that previously showed a dash. A result should appear only when the exact SKU page supplied sufficient evidence; unresolved products must keep a neutral dash.
3. Scan a newly imported OFF barcode. Confirm identity can appear without a Personal Fit score when composition is absent, and that a neighbouring flavour or pack is not substituted.
4. CSP cannot yet be product-tested. After CSP issues the official file and confirms permitted use, verify one exact GTIN across Rimi/Maxima/Lidl in the free price-comparison surface; it must not create a nutrition score.

## Remaining work

- The 1,700 supported-type incomplete rows include exact pages that returned 404, changed SKU, incomplete labelled evidence or internally contradictory values. They remain unknown until a new exact source is verified.
