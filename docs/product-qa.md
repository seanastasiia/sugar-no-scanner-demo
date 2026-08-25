# Product QA: Latvia scanner demo

Run this check on the deployed HTTPS URL using Safari on an iPhone. Use a private tab first so the public entry and camera permissions are tested from a clean state.

## Core investor path

1. Open the link. Confirm that it goes directly to the camera-first scanner with no access-code form or `Private demo` label.
2. Confirm the camera permission prompt begins immediately and `Show demo` remains visible if permission is denied or the camera is unavailable.
3. Tap `Show demo`, then `Shelf demo`. Confirm that the camera scene fills the phone and four markers appear directly over the four supported packages. Rated markers must say `Great fit`, `Moderate fit` or `Low fit`; neutral identities must not masquerade as rated picks.
4. Confirm that only a compact bottom sheet overlays the shelf. It should say `4 products · 4 with Sugar.no fit`, show product thumbnails and expose `View all`. Tap it and confirm it expands into a full-height comparison page; collapse it and confirm the held shelf returns unchanged.
5. In the expanded page, confirm that the recognized products form one vertical `Best fit first` list. Rated products must run from higher to lower Sugar.no fit, show their plain-language fit plus Protein/Sugar values and use rank numbers. Any product without a verified full fit must be last as `Needs nutrition label` without a rank number. Confirm that the leading comparable product says `Best fit in this scan` as a small heading above its brand and name, not as a separate pill beneath the Sugar.no badge. Confirm that Fiber and unexplained numeric scores such as `86` do not appear.
6. Tap each marker and each product in the ranked list. Confirm that the corresponding marker gets the white selected ring, its text appears and the product card changes.
7. Swipe the Similar options cards left and right. Confirm that they are comparable formats and remain usable without horizontal page overflow.
8. Open the Barbora action. Confirm that the exact SKU page opens in a new tab and that Sugar.no never claims affiliate revenue.
9. Return to live camera, tap `Show demo`, then `Checkout demo`. Confirm it shows the real checkout-belt photo and returns three named packaged products at once: Sproud, Schnitzer and Stockmann. Because the deterministic identity fixture contains no nutrition, the expanded list must say `Scan labels to compare`, show `Needs nutrition label` on each product and show no camera fit markers or invented Sugar.no result.
10. Expand Shelf and Checkout results. Confirm there are no `Save`, `Saved`, `Save for next shop` or `Saved options` controls; Similar options and the Barbora link must remain available.

## Camera and uncertainty

1. Return to live camera; scanning should request camera permission automatically without a separate start screen.
2. Deny permission once. Confirm there is a clear explanation, an `Enable camera` retry action and a still-visible `Show demo` path.
3. Allow permission in Safari settings, reopen the demo and point at a golden product image on another screen.
4. Confirm scanning begins without a shutter button. Keep the package still and front-facing.
5. Confirm the camera owns the full browser viewport. After a match, only the compact bottom sheet may cover it; product details should appear only after explicitly opening the sheet.
5a. On iPhone 17 Pro, rotate once to landscape and back to portrait. Confirm the camera, status, bottom sheet and expanded comparison immediately resize to the visible Safari area. `View all`, the single `Scan again` icon and the collapse arrow must remain fully visible without page-level horizontal scrolling.
6. Point at a clear food outside the 40 curated snacks. Confirm an exact product from the 7,433-record broad Barbora nutrition snapshot receives a `Great fit`, `Moderate fit` or `Low fit` marker and two-factor Sugar.no badge. Keep a visible EAN/UPC in frame when practical for the strict Open Food Facts fallback. Fiber must not appear or affect the result.
7. Show two visually similar same-brand variants or pack sizes. Confirm the correct exact SKU is selected only when its visible packaging distinguishes it; an unreadable size must remain `Needs nutrition label` instead of borrowing the neighboring candidate's fit.
7. If the named product still says `Needs nutrition label`, tap `Scan nutrition label`, turn the same pack around and fill the guide with one legible per-100 nutrition table. Confirm the top label changes to `Nutrition label`; after the read, open the result and confirm that it names `Nutrition label in this scan`, shows Protein and Sugar and produces the fit. Other products from the held shelf must remain in the list; only the selected pending item should be replaced. A serving-only, blurry or unrelated table must stay neutral and ask for a clearer view.
8. If the first broad pass is uncertain, keep one package inside the central guide. Confirm the status changes to `Trying a closer center read…` and the result appears without pressing a shutter or restarting the camera.
9. Point at a shelf containing at least three different front-facing readable products. Confirm one broad pass returns several distinct products at once rather than only the center package; up to eight distinct SKUs may be returned. If the broad pass first finds one product and the completion pass finds nothing else, the confirmed product must remain visible and locked for reading.
10. Put several identical facings of one SKU in the frame. Confirm the status and ranked list count them as one unique product, not one product per package.
11. After a successful live scan, move the phone. Confirm the captured frame and result stay fixed while being read. Tap `Scan again`, show a different product and confirm the old result is replaced rather than accumulated.
12. With no physical shelf label in the frame, confirm no `Price check` card, retailer price or price prompt appears.
13. Include the product and one clearly associated shelf label in the same frame. Confirm the camera price appears directly beneath the recognized product in the compact sheet and ranked row. If an exact Barbora match is cheaper, confirm the compact sheet shows a one-tap `Buy cheaper` action with the online price. It must open the exact SKU directly. In the expanded comparison, confirm only the shelf price is crossed out, the current online price plus check time are shown and the action says `Buy cheaper at Barbora`.
14. Repeat with a non-exact retailer candidate. Confirm only the shelf price remains and there is no retailer link. A Coca-Cola result must never open Pepsi.
15. Confirm `Great fit / Moderate fit / Low fit` markers appear only for products with a numeric full badge or quick view. A visual-only Coca-Cola or Activia result should have no camera marker; the sheet must say `Needs nutrition label` and offer the functional label-scan action rather than end at `Identified`.
16. Scan one rated product by itself. Confirm `Best fit in this scan` is absent because no comparison took place.
17. Repeat with an ambiguous label or multiple nearby prices. Confirm Sugar.no hides the shelf price instead of guessing.
18. Cover the lens or use poor light. Confirm the interface stays usable and does not invent nutrition.
19. Turn on airplane mode. Confirm that the preview stays local and recognition pauses with an offline message.
20. Keep an unmatched shelf steady for at least one minute. Confirm the app does not fall into repeated generic errors. If the server responds with a rate limit, scanning must stop, honor the shown retry delay, preserve any confirmed product and keep retry/demo actions available.

## Saved image and privacy

1. Choose `Use a saved shelf or checkout photo` and select a large phone photo.
2. Confirm it is resized on-device and either returns a readable package identity or an honest uncertainty state.
3. In Supabase, inspect `scan_events` for the session. Confirm it contains metadata only: no image, base64, URL to an uploaded frame or full user-agent.
4. Confirm the product result contains no visible `Data sources and limits` or `How this result was made` accordion; source verification remains an internal data and QA responsibility.

## Product decision questions

- Can a first-time viewer explain the value within 15 seconds without narration?
- Is the two-factor badge understood as a transparent comparison rather than a health verdict?
- Is it clear that both protein and total sugar are required and that fiber is not part of this version of the fit?
- When an automatic match has no nutrition, is `Scan nutrition label` an obvious and acceptable next action rather than a dead end?
- Do `Great fit`, `Moderate fit` and `Low fit` feel clearer than a numeric score without implying permission or prohibition?
- Is shelf comparison the primary value, with the retailer link clearly secondary?
- Is the checkout experience useful after the choice has already been made?
- Would you use the camera repeatedly, or only search/barcode after the first trial?
- Which action is worth measuring next: product comparison or retailer click?

Record the iPhone model, iOS version, location, lighting, tested SKUs, false positives, misses and time-to-result. Do not call the physical-shelf benchmark passed until those observations exist.

The shelf sample is an AI-generated interaction fixture. The checkout sample is a real project-owner photo with a deterministic three-identity response. Verify layout and comprehension with both, but do not record their deterministic detections as recognition accuracy.
