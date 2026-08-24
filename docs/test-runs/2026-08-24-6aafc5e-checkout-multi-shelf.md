# Release evidence: checkout belt and multi-product shelf scan

Implementation commit: `6aafc5e290e489b310307429aaa6e797afdb0f85`

Date: 2026-08-24, Europe/Riga

## Technical checks

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 11 files and 47 unit/integration tests passed.
- `npm run build`: Next.js 16.3.1 production and standalone build passed.
- `npm run test:e2e`: 14 Mobile Safari scenarios passed in 26.7 seconds.
- Targeted regression before the full run: checkout fixture and broad live multi-product shelf scenario both passed.
- `git diff --check`: passed before the implementation commit.

The new WebKit scenario returns three different curated products from one broad live-camera response and verifies that all three Sugar.no-rated markers and tray entries remain available together. Existing repeated-facing coverage still collapses four descriptions of the same Coca-Cola SKU into one unique product.

## Visual check

- `docs/screenshots/checkout-mobile.png` was regenerated from the new fixture and inspected at the iPhone 13 viewport.
- The frame visibly contains a supermarket conveyor belt, two red dividers, cashier/register context and four separate snack packs.
- All four deterministic boxes surround the intended packs and retain distinct Great fit, Moderate fit and Low fit states.
- The compact result sheet stays below the camera evidence and does not obscure the cashier context.

## Asset provenance

- Final project asset: `public/samples/latvia-checkout.jpg`, 941 x 1671 JPEG.
- Built-in image generation/editing was used for the composite.
- Environment reference: [Enkhjin photography on Unsplash](https://unsplash.com/photos/groceries-are-on-a-conveyor-belt-at-a-checkout-jng9usOa_J0).
- Product reference: the previous four-pack checkout fixture.
- Prompt intent: preserve the unmistakable real checkout conveyor, cashier/register and dividers; place exactly four separate demo snack bars in the central belt area; keep the result photorealistic, vertical, free of UI overlays and suitable for four aligned bounding boxes.

## Product checks for the owner

1. Open Checkout on the deployed iPhone demo and confirm the scene immediately reads as the belt beside a cashier.
2. Confirm each of the four overlays sits on one package and the bottom sheet still opens the four results.
3. Start the live camera on a shelf containing at least three different readable front-facing products; hold still and confirm several distinct products appear in one result.
4. Show several facings of one SKU and confirm they still count as one unique product.

The deterministic checkout fixture proves the interaction only. Physical-shelf recall and real checkout-belt accuracy remain unmeasured until an in-store benchmark is recorded.

## Production smoke

- Railway deployment `64002a26-88b4-469e-9ad7-595cdb993597`: `SUCCESS`.
- `GET /api/health`: `status=ok`, commit `7cc9e91c924af536446c614633a8d66a1e6e1d4e`.
- Protected checkout asset: authenticated request returned the expected 941 x 1671 JPEG.
- Authenticated deterministic checkout recognition: `matched`, four detections, `imageStored=false`.
- Authenticated real `gemini-3.7-flash` upload of the shelf concept image: `matched`, eight returned detections, 5,012 ms, `imageStored=false`.

The eight-result production call confirms that the broad model path can return several products from one complete shelf frame. Because the image is still a concept fixture, this is implementation evidence rather than a physical-store recall benchmark.
