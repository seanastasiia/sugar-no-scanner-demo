# Livinn production release

- Authorization: owner explicitly requested publishing the Livinn expansion on 3 September 2026.
- Scope: multilingual catalog/protein display through `726e2cb`, plus a standalone guard for two known contradictory Livinn tables. Personal Shelf Rank, its schema, its new scoring and its demo remain preview-only.
- Baseline production: `cc80a339fd5643aa3dbd80be808bbeecc24e6c83`.
- Working checkout: `sugar-no-scanner-livinn-release`, branch `codex/livinn-production-2026-09-03`.

## Planned technical acceptance

1. `npm run verify`: lint, types, unit/integration tests, catalog validators and production build.
2. `CI=1 npm run test:e2e`: full Mobile Safari regression suite.
3. Additive Supabase multilingual migrations; scoped import and readback of 2,489 identities and 1,853 nutrition/version records. Confirm original source counts stay unchanged and the new identity table is server-only.
4. Push the exact tested application to GitHub main, deploy only the production Railway service, await terminal success and verify the live health SHA.
5. Live HTTPS smoke: direct entry/session, unauthenticated and cross-origin rejection, multilingual exact match, barcode, missing/contradictory nutrition, no-image-storage and no pilot route. Preview and onboarding staging must retain their prior SHAs.

## Product checks for Anastasiia

1. Open the normal production link in Safari; confirm the blue retry action and 1.5-second first-camera positioning window still work.
2. Scan Bett'r Brown Rice Cakes Himalayan Salt 120 g; verify one product, protein 8.1 g and sugar 1.8 g per 100 g. Try an English or Russian listing of the same pack.
3. Open Show demo > Shelf demo > View all and confirm Protein and Sugar are visible. Foods with absent or quarantined nutrition must remain neutral and unranked.

## Results

- Tested application commit: `6e366f10f1e811ead30c1ffd69493154b857d7d6`.
- `npm ci`: passed, 0 reported vulnerabilities.
- First candidate `70f3c3a` stopped at a TypeScript union-inference error in the scoped import. Corrected before publication; no application deploy used that candidate.
- `npm run verify`: PASS, ESLint, TypeScript, 46 Vitest files / 256 tests, catalog validators and production build. Raw snapshot validation reports 1,855 collected Livinn tables; runtime health and scoped verified import exclude the two quarantines and report 1,853.
- `CI=1 npm run test:e2e`: PASS, 31/31 Mobile Safari scenarios in 1.4 minutes. Cancellation scenarios produced non-failing dev-server ECONNRESET messages; no failed/retried acceptance tests.
- Supabase project `gkivwusbobnwzrisbkle`: both additive multilingual migrations applied through the authenticated SQL Editor. Identity-table RLS enabled; anon/authenticated SELECT false, service-role access true.
- `npm run supabase:seed:livinn` dry run: 2,489 identities, 1,853 nutrition records, 2 quarantines.
- Scoped `--apply` import: PASS, verified readback 2,489 identity rows, 1,853 current nutrition rows and 1,853 immutable versions. No deletion or unrelated-source import.
- Before/after source counts unchanged: Barbora 7,433, Rimi 6,822 stored rows, Livin Latvia 6. Bett'r exact sample readback: protein 8.1 g, sugar 1.8 g, three alternate-language names. Both quarantined SKUs absent from the verified Supabase nutrition layer.
- Browser evidence is in ignored `playwright-report/` and `test-results/`; no camera images are stored in the catalog.
- GitHub / Railway publication and live smoke: pending. No production application completion is claimed yet.
