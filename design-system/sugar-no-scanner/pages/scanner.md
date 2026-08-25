# Scanner page override

This page extends `../MASTER.md` for live camera, saved shelf photos and checkout photos.

## Camera-first hierarchy

- The scene is the primary surface; product details begin in a compact bottom sheet.
- Live camera and saved images use the same recognition/result model, but saved images have no decorative crop corners because they do not define the analyzed region.
- Shelf and checkout both support several distinct SKUs in one frame. Repeated facings of one SKU count once.
- Keep the initial mobile scene at least 60% of the visible scanner area before the user expands results.

## Markers

- Render a camera marker only when a product has a numeric Sugar.no fit.
- Use a state-colored package outline and state-colored icon circle without a white ring.
- Pair `Great fit` with a check, `Moderate fit` with a minus and `Low fit` with a down arrow.
- Use the text label only where it stays readable; the expanded sheet carries the complete explanation.
- Identified-but-unrated products remain in the result list as `Needs nutrition label` and have no camera marker.

## Bottom sheet and ranking

- Collapsed: count, rated count, best-first summary, `View all`, `Scan again` and compact product previews.
- Expanded: full-height comparison page with a vertical best-fit-first ranking.
- The selected rated result shows brand/name, Protein and total Sugar per 100 g.
- The selected unrated result has one primary recovery action: `Scan nutrition label`.
- `Similar options` stays a horizontal row; the main detected-product ranking is vertical.
- Checkout uses the same comparison pattern and never asks the user to undo or save a purchase.

## Price behavior

- A shelf price appears only when a physical price label is clearly associated with the SKU.
- Cross out the shelf price only when an exact current Barbora offer for the same SKU is cheaper.
- Use `Cheaper at Barbora` and `Buy cheaper on Barbora`; possible matches cannot drive a price claim or link.

## Accessibility and evidence

- Controls are at least 44 px and respect safe areas, 320 px width, landscape, enlarged text and reduced motion.
- Camera controls use a restrained scrim and translucent black capsules.
- Generated sample scenes prove the interaction, not real-world recognition accuracy.
- Keep confidence, source and prototype-limit details in internal QA documentation rather than the investor flow.
