# Product QA: Latvia scanner demo

Run this check on the deployed HTTPS URL using Safari on an iPhone. Use a private tab first so access and camera permissions are tested from a clean state.

## Core investor path

1. Open the private link. Confirm that the demo requires the access code and does not appear in search engines.
2. Enter the code. Confirm that the first screen says `19,076 Barbora pages indexed` and distinguishes package recognition from retailer-listed Sugar.no nutrition.
3. Tap `Shelf photo`. Confirm that the camera scene fills the phone and four markers appear directly over the four supported packages: green check, yellow minus or coral alert. The selected marker must also say `Great fit`, `Moderate fit` or `Low fit`.
4. Confirm that only a compact bottom sheet overlays the shelf. It should say `4 Sugar.no picks`, show product thumbnails and expose `View products` plus a list icon. Tap it and confirm it expands into a full-height comparison page; collapse it and confirm the held shelf returns unchanged.
5. In the expanded page, confirm that the leading comparable product says `Best fit in this scan` as a small heading above its brand and name, not as a separate pill beneath the Sugar.no badge. Confirm that the selected card has one compact Sugar.no badge with separate Protein, Fiber and Sugar signals, source values per 100 g and direction text. Confirm that no unexplained numeric score such as `86` appears.
6. Tap each marker and each small product in the tray. Confirm that the corresponding marker gets the white selected ring, its text appears and the product card changes.
7. Swipe the Similar options cards left and right. Confirm that they are comparable formats and remain usable without horizontal page overflow.
8. Open the Barbora action. Confirm that the exact SKU page opens in a new tab and that Sugar.no never claims affiliate revenue.
9. Collapse the page and use the `Shelf / Checkout` switch inside the scanner. Confirm that Checkout opens without closing the scanner, shows one photorealistic image of the whole belt and returns four products at once with the same marker and expandable-sheet interaction.
10. Expand Shelf and Checkout results. Confirm there are no `Save`, `Saved`, `Save for next shop` or `Saved options` controls; Similar options and the Barbora link must remain available.

## Camera and uncertainty

1. Return to the first screen and tap `Start live camera`.
2. Deny permission once. Confirm there is a clear explanation, a retry action and access to the sample path after closing.
3. Allow permission in Safari settings, reopen the demo and point at a golden product image on another screen.
4. Confirm scanning begins without a shutter button. Keep the package still and front-facing.
5. Confirm the camera owns the full browser viewport. After a match, only the compact bottom sheet may cover it; product details should appear only after explicitly opening the sheet.
6. Point at a clear food outside the 40 curated snacks. If the exact Barbora page lists energy, protein and total sugar, confirm a marker appears and the card says `Sugar.no quick view · 2/3`; fiber must say `Not listed`, not `Lower`. If the page lacks enough nutrition, confirm the product is named without a marker or invented score.
7. If the first broad pass is uncertain, keep one package inside the central guide. Confirm the status changes to `Trying a closer center read…` and the result appears without pressing a shutter or restarting the camera.
8. Point at a shelf containing at least three different front-facing readable products. Confirm one broad pass returns several distinct products at once rather than only the center package; up to eight distinct SKUs may be returned.
9. Put several identical facings of one SKU in the frame. Confirm the status and tray count them as one unique product, not one product per package.
10. After a successful live scan, move the phone. Confirm the captured frame and result stay fixed while being read. Tap `Scan again`, show a different product and confirm the old result is replaced rather than accumulated.
11. With no physical shelf label in the frame, confirm no `Price check` card, retailer price or price prompt appears.
12. Include the product and one clearly associated shelf label in the same frame. Confirm the camera price appears directly beneath the recognized product in the compact sheet and product tray. If an exact Barbora match is cheaper, confirm the compact sheet shows a one-tap `Buy cheaper` action with the online price. It must open the exact SKU directly. In the expanded comparison, confirm only the shelf price is crossed out, the current online price plus check time are shown and the action says `Buy cheaper at Barbora`.
13. Repeat with a non-exact retailer candidate. Confirm only the shelf price remains and there is no retailer link. A Coca-Cola result must never open Pepsi.
14. Confirm `Great fit / Moderate fit / Low fit` markers appear only for products with a numeric full badge or quick view. A visual-only Coca-Cola or Activia result should have no camera marker and should say that it was identified but not highlighted.
15. Scan one rated product by itself. Confirm `Best fit in this scan` is absent because no comparison took place.
16. Repeat with an ambiguous label or multiple nearby prices. Confirm Sugar.no hides the shelf price instead of guessing.
17. Cover the lens or use poor light. Confirm the interface stays usable and does not invent nutrition.
18. Turn on airplane mode. Confirm that the preview stays local and recognition pauses with an offline message.

## Saved image and privacy

1. Choose `Use a saved shelf or checkout photo` and select a large phone photo.
2. Confirm it is resized on-device and either returns a readable package identity or an honest uncertainty state.
3. In Supabase, inspect `scan_events` for the session. Confirm it contains metadata only: no image, base64, URL to an uploaded frame or full user-agent.
4. Confirm the product result contains no visible `Data sources and limits` or `How this result was made` accordion; source verification remains an internal data and QA responsibility.

## Product decision questions

- Can a first-time viewer explain the value within 15 seconds without narration?
- Is the three-signal badge understood as a within-category comparison rather than a health verdict?
- Is `2/3` understood as a useful partial view rather than a complete badge, and is missing fiber visibly neutral?
- Do `Great fit`, `Moderate fit` and `Low fit` feel clearer than a numeric score without implying permission or prohibition?
- Is shelf comparison the primary value, with the retailer link clearly secondary?
- Is the checkout experience useful after the choice has already been made?
- Would you use the camera repeatedly, or only search/barcode after the first trial?
- Which action is worth measuring next: product comparison or retailer click?

Record the iPhone model, iOS version, location, lighting, tested SKUs, false positives, misses and time-to-result. Do not call the physical-shelf benchmark passed until those observations exist.

The two guaranteed sample photos are AI-generated interaction fixtures. Verify layout and comprehension with them, but do not record their deterministic detections as recognition accuracy.
