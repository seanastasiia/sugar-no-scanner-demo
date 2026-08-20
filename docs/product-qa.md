# Product QA: Latvia scanner demo

Run this check on the deployed HTTPS URL using Safari on an iPhone. Use a private tab first so access and camera permissions are tested from a clean state.

## Core investor path

1. Open the private link. Confirm that the demo requires the access code and does not appear in search engines.
2. Enter the code. Confirm that the first screen says `40 Latvia protein snacks` and explains protein, fiber and total sugar without good/bad language.
3. Tap `Shelf scene`. Confirm that four boxes appear automatically, the selected product is correct and the card shows Match plus all three inputs per 100 g.
4. Tap each small product in the tray. Confirm that the corresponding box/card changes and the best visible item is clearly labelled.
5. Open a similar option. Confirm that it is a comparable format and has a numeric Match.
6. Open `View at Barbora · check current price`. Confirm that the exact SKU page opens in a new tab and that Sugar.no never claims it is cheaper or affiliate-paid.
7. Return and start `Checkout scene`. Let five items pass. Confirm that the tray stops at four distinct SKUs and the copy says `For next time`, not that the current purchase is wrong.

## Camera and uncertainty

1. Return to the first screen and tap `Start live camera`.
2. Deny permission once. Confirm there is a clear explanation, a retry action and access to the sample path after closing.
3. Allow permission in Safari settings, reopen the demo and point at a golden product image on another screen.
4. Confirm scanning begins without a shutter button. Keep the package still and front-facing.
5. Point at an unsupported product. Confirm the app says `Not sure — point closer` rather than assigning a known item.
6. Cover the lens or use poor light. Confirm the interface stays usable and does not invent nutrition.
7. Turn on airplane mode. Confirm that the preview stays local and recognition pauses with an offline message.

## Saved image and privacy

1. Choose `Use a saved product image` and select a large phone photo.
2. Confirm it is resized on-device and either returns a high-confidence supported result or an honest uncertainty state.
3. In Supabase, inspect `scan_events` for the session. Confirm it contains metadata only: no image, base64, URL to an uploaded frame or full user-agent.
4. Confirm source links and dates are visible under `Data sources and limits`.

## Product decision questions

- Can a first-time viewer explain the value within 15 seconds without narration?
- Is Match understood as a within-category comparison rather than a health verdict?
- Is shelf comparison the primary value, with the retailer link clearly secondary?
- Is the checkout experience useful after the choice has already been made?
- Would you use the camera repeatedly, or only search/barcode after the first trial?
- Which action is worth measuring next: product comparison, saved alternative or retailer click?

Record the iPhone model, iOS version, location, lighting, tested SKUs, false positives, misses and time-to-result. Do not call the physical-shelf benchmark passed until those observations exist.
