# Checkout demo rated-products release — 2026-08-25

## Outcome

The real checkout-belt demo no longer looks unrecognized. Its deterministic response still pins only the three package identities previously read from the supplied photo, but each identity now carries a source-backed Protein/Sugar record. The camera renders three labelled fit outlines and the expanded page renders a complete best-first comparison.

- Sproud Barista: `Great fit`, manufacturer reference.
- Stockmann fresh chanterelles: `Great fit`, generic raw-chanterelle food-composition reference.
- Schnitzer Bio Burger Buns: `Moderate fit`, manufacturer reference.

The chanterelle source is deliberately labelled `Food composition reference`; this is not presented as an exact Stockmann nutrition audit. The deterministic photo is interaction evidence, not a computer-vision accuracy benchmark.

## Release

- Behavior commit: `6720faca2ec5f8f60cbd61ab45e39dccc4d28658`
- GitHub: pushed to `main`
- Railway deployment: `5e549118-f593-4677-af8a-ac99e23f7069`
- Railway result: `SUCCESS`
- Railway build log: <https://railway.com/project/9e2a4887-0e19-4ca7-ae99-d68816542558/service/6d0d8abe-cb63-4d29-96bd-c3a290be3e7c?id=5e549118-f593-4677-af8a-ac99e23f7069>
- Production: <https://sugar-no-scanner-demo-production.up.railway.app/>

## Technical checks

| Check | Result |
| --- | --- |
| `npm test -- --run src/server/recognition.test.ts` | 18/18 passed |
| `npm run typecheck` | passed |
| Targeted checkout/demo Mobile Safari tests | 2/2 passed |
| `npm run verify` | lint passed; typecheck passed; 109/109 tests passed; production build passed |
| `CI=1 npm run test:e2e` | 21/21 Mobile Safari scenarios passed |
| Final checkout regression after source-label assertion | 1/1 passed |
| `git diff --check` | passed |

The committed reference screenshots are:

- [collapsed checkout camera](../screenshots/checkout-mobile.png)
- [expanded checkout ranking](../screenshots/checkout-results-mobile.png)

## Production smoke

- `/api/health` returned `status: ok` and exact commit `6720faca2ec5f8f60cbd61ab45e39dccc4d28658`.
- `POST /api/recognize` with `source: sample-conveyor` returned `matched`, `imageStored: false`, scores `100 / 60 / 100` and bases `manufacturer_reference / manufacturer_reference / food_composition_reference`.
- Headless Mobile Safari at `402 × 874` opened `Show demo → Checkout demo` and found three accessible markers:
  - `Open Barista pea drink 1L: Great fit`
  - `Open Bio Burger Buns gluten-free 250g: Moderate fit`
  - `Open Fresh chanterelles: Great fit`
- The production page had no page-level horizontal overflow.

## Product checks

1. On an iPhone, open production and tap `Show demo → Checkout demo`.
2. Confirm that three coloured outlines appear on the actual checkout photo and that the status says `3 products · 3 with Sugar.no fit`.
3. Tap `View all`; confirm the list order is Sproud, Stockmann, Schnitzer and the fits are `Great / Great / Moderate`.
4. Open Sproud and Schnitzer; confirm the badge says `Manufacturer nutrition`.
5. Open Stockmann chanterelles; confirm the badge says `Food composition reference`.
6. Confirm that no checkout price or Barbora purchase action is invented for these products.
