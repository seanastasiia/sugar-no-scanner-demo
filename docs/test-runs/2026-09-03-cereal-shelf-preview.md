# Cereal shelf recognition and Personal Shelf retention, preview QA

Date: 3 September 2026, Europe/Riga. Scope: the owner's Turtle shelf photo and the isolated Personal Shelf preview. Production was not published or changed.

## Revision and deployment

- Tested, pushed and deployed application commit: `eaa7f73e6366d64338846fea647b32133dc95134`.
- GitHub branch: `codex/cereal-shelf-preview`, repository `seanastasiia/sugar-no-scanner-demo`.
- Railway project: `9e2a4887-0e19-4ca7-ae99-d68816542558`; environment: `personal-rank-preview`; service: `37730464-07ba-482d-9c59-74c04ecdf6db`.
- Explicit CLI deployment: `aae61182-3639-4c47-8ff7-906903bf66dc`, terminal **SUCCESS**. [Deployment](https://railway.com/project/9e2a4887-0e19-4ca7-ae99-d68816542558/service/37730464-07ba-482d-9c59-74c04ecdf6db?id=aae61182-3639-4c47-8ff7-906903bf66dc).
- Live [health](https://sugar-no-personal-rank-personal-rank-preview.up.railway.app/api/health) returned HTTP 200, the exact application commit and `personal-shelf-v1.2-bounded`.
- GitHub main and production health remained `ab813c710f41ee7423f19ff35acb95381140c98d`, model `personal-shelf-v1.1-bounded`.
- Preview Supabase service-role, Amplitude and Resend keys remain absent; shared-web-catalog health is false. No Supabase migration/import, production variable change, analytics write or email configuration was performed.
- A first Railway deployment-list read timed out; the subsequent read confirmed SUCCESS. The new deployment's build logs and health were checked, not the default historical successful build logs.
- This report and its README/Bugs/model wording corrections are a subsequent documentation-only commit; the application revision above remains the tested live revision.

## Technical checks

All commands ran in `/Users/anastasiia/Documents/ChatGPT/sugar-no-scanner-livinn-release`. Local logs are in `/tmp/sugar-cereal-qa.wvsGDh` and may be removed by system cleanup; durable results are recorded here. No raw photo was copied into the repository or report.

| Check | Result | Local log |
| --- | --- | --- |
| `npm run verify` before committing the same code | Pass: lint, types, 61 files / 465 unit and integration tests, catalog validators, build | `verify-worktree.log` |
| Exact commit: `npm run lint && npm run typecheck && npm test -- --maxWorkers=1 && npm run verify:catalog && npm run build` | Pass: 61 files / 465 tests, all validators, Next standalone build | `verify-eaa7f73.log` |
| `E2E_PORT=3102 CI=1 npm run test:e2e -- --workers=1 --retries=0` | Two full runs: 57 passed / 1 failed each; initial feedback-page navigation timed out before assertions | `e2e-eaa7f73.log`, `e2e-eaa7f73-confirm.log` |
| Same feedback case alone | Pass: 1/1 | `feedback-isolated.log` |
| Preceding contrast case plus feedback case | Pass: 2/2 | `feedback-after-contrast.log` |
| Full suite, two fresh sessions: previous E2E command plus `--fully-parallel --shard=1/2`, then `--shard=2/2` | Pass: 29/29 in 56.3 s, 29/29 in 1.3 min; all 58 cases, one worker, no retries or skipped assertions | `e2e-eaa7f73-shard1.log`, `e2e-eaa7f73-shard2.log` |

The monolithic navigation issue remains a known harness limitation with an unproven cause, not a silently passing test. Existing cancelled-request ECONNRESET and Next image-dimension warnings appeared in local development tests. Production cookie security and assertions were not weakened.

New regression checks cover cereal category exclusions, prepared-with-milk rejection, seed versus extracted-oil/protein bases, outdated checkpoints, exact reviewed English aliases, pack/flavour conflicts, fast and complete recognition, unsupported and visual-only card retention, and all eight exact Turtle assessments. The browser scenarios use mocked recognition responses and real checked-in evidence; they do not measure recognition accuracy.

## Evidence and rating impact

The cereal-scoped known-URL batch attempted 291 URLs with one worker per source. It added 285 observations: Barbora 98, Rimi 125, Livinn 60 and OFF 2. Six sources failed closed, three each from Barbora and Rimi; this cereal batch had no HTTP 429. Retailer and OFF evidence stay in separate files. This is a bounded batch, not an ongoing job.

Validated shared observations: **1,533 = 287 complete + 925 provisional + 321 unscored**. The separate four demo observations are excluded. Breakfast cereals contain 284 source records, with 34 complete and 197 provisional assessments, totaling 231. Of 285 new observations, 54 remain unscored, including one unsupported-category OFF row. Counts are source/SKU records, not globally unique products.

All 1,248 prior raw observations retained their contents. All 976 previously assessable records retained identical assessments, ignoring the model-version field. Five existing unknown seed-base records became assessable: `ALCE80972` 33, `OMEG7011` 59, `SESA8101` 36, `SESA8102` 37 and `SESA8103` 38, all under `livinn_lt`. The same 19 contradictory tables remain unscored.

The new category uses sugar/protein/food-base/balance weights 30/20/25/25. Existing categories, thresholds and ceilings are unchanged. These are product-preference weights, not a validated health rating. Missing fiber remains null and bounded; essential missing data still prevents a score.

Eight Turtle English package labels are identity-only aliases pinned to the reviewed Livinn URL, brand, pack and image. Wrong sizes, extra flavours and changed metadata fail closed. Local retailer matching now happens before crop merging; network enrichment remains deferred. Manufacturer nutrition is not copied across markets or recipes. The Cinnamon Crunch/Bites identity review is linked in [model documentation](../personal-shelf-rank.md).

## Real photo, live provider replay

Ran `npx tsx scripts/check-personal-shelf-photo.ts <preview-origin> <owner-photo-path>` against the deployed preview. The script uses client crop geometry, four real recognition requests, 1280 px JPEG preparation via Sharp rather than browser canvas, progressive enrichment, exact product reads and the matching local pure ranker. It is not a physical-phone upload test. All recognition/enrichment responses returned `imageStored: false`; photo bytes stayed in request memory.

Before the fix, one attempt timed out at 60 seconds. A second baseline run at `85e65c1` completed in 31 seconds: ten retained detections, zero Personal Shelf groups, six unsupported products and four unresolved names. Several English Turtle labels went to web search instead of the existing Livinn cards. A wrongly detected 300 g Bran Flakes pack was not silently rewritten to 375 g.

After the fix, the replay completed at **2026-09-03T16:24:41.692Z**, in **23 seconds**. Four frames returned 10, 4, 10 and 10 detections; merging retained the existing maximum of ten. All eight Turtle records matched the retailer catalog and had complete assessments:

| Place in this retained cereal group | Exact Livinn SKU | Reviewed package identity | Score |
| --- | --- | --- | --- |
| 1 | `TURT3044` | Low Sugar Pillows Peanut Butter 300 g | 79 |
| 2 | `TURT3036` | Bran Flakes Organic 375 g | 76 |
| 3 | `TURT3070` | Protein Cocoa Balls 250 g | 69 |
| 4 | `TURT3024` | Power Granola Nuts & Seeds 350 g | 59 |
| 5 | `TURT3038` | Color Loops 300 g | 51 |
| 6 | `TURT3048` | Cinnamon Crunch 300 g | 50 |
| 7 | `TURT3022` | Cornflakes Dark Chocolate 250 g | 40 |
| 8 | `TURT3041` | Cocoa Pillows Hazelnut Filling 300 g | 29 |

Viblance Granola Cocoberry 275 g and Light Berry & Chia 250 g remained named visual-only detections, without invented nutrition. The renderer's tested fallback retains these as cards. The replay did not verify every product visible on the crowded shelf; the ten-product limit is unchanged. A single replay is not an accuracy or latency benchmark, and future model output can differ.

Metadata-only logs: `photo-eaa7f73.json`, `photo-eaa7f73.log` in the local log directory. Request IDs: `f027f819-b1e7-4b62-984b-446d69eabce0`, `20adbf8b-c8c8-4348-9ad3-4104189f5a03`, `beec40c2-5aea-4eb0-b609-6620ee2c0a22`, `b7374eb7-f243-4328-b598-4f3201701068`.

Live browser smoke also passed: ordinary Shelf demo showed four 59/100 provisional bar scores; switching off Personal Shelf restored the original Fit cards. The separate chip demo retained 64, 61, 57-59 and the intentionally unscored chip, without a Chips button. This check reused the existing layout; it did not introduce a new design. Camera hardware was unavailable in the browser tool, so physical-camera acceptance remains with the owner.

## Owner product check

1. Reload the [preview](https://sugar-no-personal-rank-personal-rank-preview.up.railway.app/), select Use saved photo and upload the same Turtle shelf image.
2. Open View all and enable Personal Shelf Rank. Check that Turtle products have cereal scores and unverified Viblance products remain named cards rather than disappearing.
3. Expand a rated card to inspect the points. Switch Personal Shelf off and confirm original Fit is restored.
4. Try another photo/variant. Wrong or unreadable pack size, unsupported categories and absent essential nutrition must not inherit a sibling's score. A crowded photo can retain at most ten products.

Remaining limits: source freshness and recipe changes, six failed batch URLs, incomplete Viblance evidence, non-universal language coverage, ten-product cap, unvalidated physical-store accuracy and the long-run local navigation flake. Production publication needs separate approval and coordination with AR (Launch).
