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
- Published application: GitHub `main` at `e1e5ce08651b8fbd80b4879d65d195b2f2c8d50e`, identical application/schema/scripts to tested `6e366f1` (documentation-only difference).
- Direct Railway deployment `1301da80-3e32-4439-9106-893ff74af127`: SUCCESS; live HTTPS health matched `e1e5ce0` and reported 2,489 Livinn identities / 1,853 eligible nutrition records. GitHub also started an automatic deployment for the same commit; Railway superseded it with the explicit direct upload. No other service was deployed by this task.
- Live smoke: PASS. Root and silent secure HTTP-only session; bare API 401; cross-origin API 403; exact Bett'r barcode returns protein 8.1 g / sugar 1.8 g; both quarantines and the incomplete `02000005925` stay identifiable and unrated. All API responses declare `imageStored=false`.
- English `Brown Rice Cakes Himalayan Salt` and Russian `Рисовые крекеры с гималайской солью`, each without a barcode, resolved the same `livinn_lt:1G1701009280` on production (316 ms / 262 ms server enrichment in this smoke; not a general camera-speed benchmark).
- Live sample-shelf API returned four products; browser Shelf demo displayed Protein and Sugar in all four cards and the existing comparison controls. `/demo/personal-shelf` returned 404 on production, confirming the pilot was not shipped.
- Read-only environment checks stayed unchanged across deployment: preview `5f7198e728499c4fccbe3cbef7f5f3cbc75f7e5e`, onboarding staging `f6a28f60833ba72aa4e7e53021c321dc96c97d3d`. The staging baseline was checked live before publication; older notes naming `621609f` were outdated.
- Live server logs show the expected fallback for optional, absent `public.products`; the existing snapshot and independent Supabase layers work. No new recognition exception was observed.
- Live API assertions: ignored `test-results/livinn-live-smoke.mjs`. Physical-store accuracy and source corrections remain owner follow-up, not claimed by these automated checks.
