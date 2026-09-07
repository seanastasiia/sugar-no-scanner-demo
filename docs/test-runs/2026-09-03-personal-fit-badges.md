# Personal Shelf fit badges, preview QA

Date: 3 September 2026, Europe/Riga. Application commit: `b60824d7ffec6fb4a113948330e3fa9b7a306b3c`, branch `codex/personal-fit-badges-preview`. This is a preview-only presentation change; no main merge or production deployment is authorized by it.

## Behavior

Both Personal Shelf scan results and the compact chip demo now show Great fit at 75–100, Moderate fit at 50–74 and Low fit at 0–49, beside the unchanged numeric score. Cards have subtle green, amber or coral tints with matching borders. These are product-preference presentation bands, not health thresholds or the original sugar/protein Fit formula. The legend is inside the existing score disclosure.

The helper consumes existing assessments only. Provisional ranges within one band keep that badge and their existing fiber/provisional label; a range crossing 50 or 75 receives a neutral dual-band label. Missing, unsupported, contradictory or malformed results get no badge. Numeric scorer, source files, ranks, recognition, original Fit, database and integration settings are unchanged.

## Tests on the exact application commit

- `npm run verify`: PASS. Lint, TypeScript, 62 files / **494 unit and integration tests**, all catalog validators and the standalone production build.
- `E2E_PORT=3102 CI=1 npm run test:e2e -- --workers=1 --retries=0 --fully-parallel --shard=1/2`: **29/29 PASS**, 56.7 seconds.
- Same command with `--shard=2/2`: **29/29 PASS**, 1.3 minutes. All 58 Mobile Safari cases ran, with no retries or weakened assertions. Fresh sessions follow the previously documented long-run navigation limitation.
- Explicit checks: thresholds 0/49/50/74/75/100, invalid/absent scores, unknown states with stale fields, interval crossings and capped 59–59, immutability, badge-text contrast at least 4.5:1, neutral unscored cards, all three tones on the eight real Turtle source records, restore-original-Fit, dark-system setting, reduced motion, 200% text, small phones and landscape.
- Axe checks of the Personal Shelf result region and compact demo: no violations. The existing broader application's normal-mode contrast limitations were not changed.
- Existing development warnings about the white logo dimensions and intentionally cancelled requests appeared; tests passed.
- Catalog validation retained 1,533 observations, 287 complete and 925 provisional assessments; no source or numeric model update. Model remains `personal-shelf-v1.2-bounded`.

Local evidence folder: `/tmp/sugar-fit-badges-qa.rn0NLK`. Logs: `verify.log`, `e2e-shard1.log`, `e2e-shard2.log`. Visually inspected and saved `turtle-badges.png` and `demo-badges.png`; these are browser-fixture screenshots, not a new real-photo recognition benchmark. The temporary folder may be cleaned by the system. Raw photos and generated screenshots are not committed.

## Owner check

Reload the [preview](https://sugar-no-personal-rank-personal-rank-preview.up.railway.app/), upload the same Turtle photo and enable Personal Shelf Rank in View all. Expect 79/76 Great fit, 69/59/51/50 Moderate fit, 40/29 Low fit if the same products are recognized. Unknown Viblance cards must stay neutral. Switch off to restore original Fit. In the chip demo, 64/61/57–59 are Moderate fit and the contradictory chip stays unscored. A 71–81 provisional fixture remains neutral with `Moderate to Great fit`.

## Deployment verification

- Railway project `9e2a4887-0e19-4ca7-ae99-d68816542558`, environment `personal-rank-preview`, service `37730464-07ba-482d-9c59-74c04ecdf6db`.
- Explicit CLI deployment `b49ec7f5-13ce-462a-989f-8423772f0f4e`: **SUCCESS**. [Deployment](https://railway.com/project/9e2a4887-0e19-4ca7-ae99-d68816542558/service/37730464-07ba-482d-9c59-74c04ecdf6db?id=b49ec7f5-13ce-462a-989f-8423772f0f4e).
- Live HTTPS health at `2026-09-03T16:45:45.856Z`: HTTP 200, exact tested `b60824d` commit, unchanged model/counts, shared web catalog false.
- Live compact-demo browser smoke: three Moderate fit badges, unchanged 64/61/57–59 scores, amber card gradients/borders and an unscored neutral fourth card. CSS was checked after the production build, not only in the local development server.
- Live ordinary Shelf demo: four 59/100 provisional Moderate fit cards; switching Personal Shelf off restored the original Fit cards.
- GitHub main and production HTTPS health remained `ab813c710f41ee7423f19ff35acb95381140c98d`. No production deployment, database operation, credential or analytics configuration change occurred.

This report and its documentation links are a subsequent documentation-only commit; they do not change the tested application revision.
