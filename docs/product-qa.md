# Product QA: Latvia scanner demo

Run this check on the deployed HTTPS URL using Safari on an iPhone. Use a private tab first so access and camera permissions are tested from a clean state.

## Core investor path

1. Open the private link. Confirm that the demo requires the access code and does not appear in search engines.
2. Enter the code. Confirm that the first screen says `19,000+ Barbora products indexed` and distinguishes package recognition from verified Sugar.no nutrition.
3. Tap `Shelf photo`. Confirm that the source is one photorealistic shelf scene and that four markers appear directly over the four supported packages: green check, yellow minus or coral alert. The selected marker must also say `Top fit`, `Mixed` or `Trade-offs`, and the same icon/text legend must appear below the photo.
4. Confirm that the selected card has one compact Sugar.no badge with separate Protein, Fiber and Sugar signals, source values per 100 g and direction text. Confirm that no unexplained numeric score such as `86` appears.
5. Tap each marker and each small product in the tray. Confirm that the corresponding marker gets the white selected ring, its text appears and the product card changes.
6. Swipe the Similar options cards left and right. Confirm that they are comparable formats and remain usable without horizontal page overflow.
7. Open the Barbora action. Confirm that the exact SKU page opens in a new tab and that Sugar.no never claims affiliate revenue.
8. Use the `Shelf / Checkout` switch inside the scanner. Confirm that Checkout opens without closing the result, shows one photorealistic image of the whole belt and returns four products at once with the same marker, tray and Sugar.no badge interaction.
9. Tap `Save for next shop` on the selected product and `Save` on one Similar option. Confirm the success message appears, then close the scanner and find both under `Saved options`.
10. Reload the page. Confirm both saved products remain, each exact Barbora link opens and the remove button removes only that item. The demo should say that saves live only in this browser.

## Camera and uncertainty

1. Return to the first screen and tap `Start live camera`.
2. Deny permission once. Confirm there is a clear explanation, a retry action and access to the sample path after closing.
3. Allow permission in Safari settings, reopen the demo and point at a golden product image on another screen.
4. Confirm scanning begins without a shutter button. Keep the package still and front-facing.
5. Point at a clear product outside the 40 scored snacks. Confirm the app names the package, labels nutrition as unverified and does not invent a Sugar.no badge.
6. Put several identical facings of one SKU in the frame. Confirm the status and tray count them as one unique product, not one product per package.
7. After a successful live scan, move the phone. Confirm the captured frame and result stay fixed while being read. Tap `Scan again`, show a different product and confirm the old result is replaced rather than accumulated.
8. With no physical shelf label in the frame, confirm no `Price check` card, retailer price or price prompt appears.
9. Include the product and one clearly associated shelf label in the same frame. Confirm the camera price appears. If an exact Barbora match is cheaper, confirm only the shelf price is crossed out and the current online price plus check time are shown.
10. Repeat with a non-exact retailer candidate. Confirm only the shelf price remains and there is no retailer link. A Coca-Cola result must never open Pepsi.
11. Confirm `Top fit / Mixed / Trade-offs` appears only for products with complete verified nutrition. A generic Coca-Cola or Activia result should instead say `Identified, not rated`.
12. Repeat with an ambiguous label or multiple nearby prices. Confirm Sugar.no hides the shelf price instead of guessing.
13. Cover the lens or use poor light. Confirm the interface stays usable and does not invent nutrition.
14. Turn on airplane mode. Confirm that the preview stays local and recognition pauses with an offline message.

## Saved image and privacy

1. Choose `Use a saved shelf or checkout photo` and select a large phone photo.
2. Confirm it is resized on-device and either returns a readable package identity or an honest uncertainty state.
3. In Supabase, inspect `scan_events` for the session. Confirm it contains metadata only: no image, base64, URL to an uploaded frame or full user-agent.
4. Confirm source links and dates are visible under `Data sources and limits`.

## Product decision questions

- Can a first-time viewer explain the value within 15 seconds without narration?
- Is the three-signal badge understood as a within-category comparison rather than a health verdict?
- Do `Top fit`, `Mixed` and `Trade-offs` feel clearer than a numeric score without implying permission or prohibition?
- Is shelf comparison the primary value, with the retailer link clearly secondary?
- Is the checkout experience useful after the choice has already been made?
- Would you use the camera repeatedly, or only search/barcode after the first trial?
- Which action is worth measuring next: product comparison, saved alternative or retailer click?

Record the iPhone model, iOS version, location, lighting, tested SKUs, false positives, misses and time-to-result. Do not call the physical-shelf benchmark passed until those observations exist.

The two guaranteed sample photos are AI-generated interaction fixtures. Verify layout and comprehension with them, but do not record their deterministic detections as recognition accuracy.
