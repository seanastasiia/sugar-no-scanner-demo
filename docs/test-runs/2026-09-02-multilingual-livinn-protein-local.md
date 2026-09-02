# Multilingual Livinn coverage and protein-card QA

- Date: 2026-09-02
- Tested implementation commit: `386f053`
- Branch: `codex/multilingual-catalog-protein`
- Status: local only; not pushed or deployed

## Catalog evidence

- Livinn Lithuania sync accounted for all 5,926 canonical product URLs.
- 2,489 source-classified edible identities were retained; 1,855 have exact energy, protein and total sugar for Sugar.no fit; 634 remain explicitly unrated.
- 2,453 identities contain at least one source-provided alternate-language name; all 2,489 identities contain an exact GTIN.
- Bett'r `1G1701009280`, Valledoro `1AM092401277` and Sottolestelle `SOTT0299` passed representative exact-SKU nutrition guards.
- The Open Food Facts regional Lithuania/Belarus bulk layer is wired and validated but intentionally remains empty until an approved durable download job runs.

## Technical checks

- `npm run verify`: passed ESLint, TypeScript, all 45 Vitest files / 251 tests, catalog integrity, Barbora coverage and the Next.js production build.
- `CI=1 npm run test:e2e`: passed all 31 Mobile Safari scenarios after updating the compact-card expectation from sugar-only to protein plus sugar.
- Targeted multilingual retailer, recognition, barcode, duplicate-merging and compact-nutrition tests passed.
- Supabase external-catalog dry run reported 7,433 complete Barbora rows and 2,489 Livinn food identities.
- `git diff --check`: passed.

## Visual checks

- iPhone 17 Pro, adjacent phone sizes, landscape, large text, dark mode and reduced motion passed.
- Rated cards visibly show `Protein …g · Sugar …g` and optional source-backed `Carbs …g` without horizontal overflow.
- The final local screenshots are under ignored `test-results/`, including `shelf-results-mobile.png` and `iphone-17-pro-results.png`.

## Product checks for Anastasiia

1. After a later approved production release, open `Show demo` → `Shelf demo` → `View all` and confirm every rated row shows Protein and Sugar.
2. Upload a listing or scan Bett'r Brown Rice Cakes Himalayan Salt 120 g in English or Russian and confirm it resolves once, with protein 8.1 g and sugar 1.8 g per 100 g.
3. Confirm an exact Livinn food without complete nutrition remains visible but neutral, with no fit.
