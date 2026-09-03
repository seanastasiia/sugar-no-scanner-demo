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

Pending. No production completion is claimed until all required checks finish.
