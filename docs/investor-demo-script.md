# Investor demo script

Target length: 2–3 minutes. Use the deterministic shelf and checkout scenes for the meeting; use live camera only as an optional bonus after the guaranteed flow.

## Opening

“The hypothesis is simple: make a shelf understandable before purchase, then remain useful after purchase. This is computer vision with an AR-style overlay, not VR.”

Show the private access screen and enter the code.

“For this Latvia proof of concept we index 19,076 Barbora pages, so the camera can name ordinary packaged products. Ten curated snacks have the full three-signal category badge. For an exact food outside that set, we can now build a live two-signal quick view from the nutrition on its exact Barbora page. The model never invents nutrition.”

## Shelf

Tap `Shelf photo`.

“One camera view compares what is visible without asking the user to choose protein, fiber or sugar first. Compact markers sit directly over the products in the shelf image. A green check, yellow minus and coral alert make the comparison scannable; Top fit, Mixed and Trade-offs carry the same meaning without relying on color alone.”

Tap two product boxes and show the Sugar.no badge.

“Instead of an unexplained score such as 86, the card shows protein, fiber and total sugar separately. The full curated badge is a relative comparison inside the protein-snack catalog. Outside it, a clearly labelled quick view uses transparent reference bands from the exact retailer page. If fiber is not listed, it stays neutral and the card says two of three — it never pretends to know.”

Open a similar option.

“Similar options scroll horizontally. They are ranked by category similarity and the internal comparison, while commercial availability never changes the recommendation.”

Open the Barbora CTA, then return.

“The retailer action is deliberately secondary. If the camera can associate a shelf label with an exact package, we check the live Barbora page. We cross out the shelf price only when the exact online SKU is genuinely cheaper. With one retailer we call this a Barbora price check, not the best price, and we do not claim affiliate revenue that does not exist.”

For the optional live-camera moment, show several facings of one SKU. Explain that repeated cans count as one product type and that the successful frame is held while the viewer reads. Tap `Scan again` before showing a different product; the new scan replaces the old one instead of accumulating it.

## Checkout

Tap `Checkout photo`.

“Checkout uses exactly the same behavior as the shelf: one view of the whole belt, several detected packages and colored overlays on the image. We do not tell someone to undo a purchase or shame the basket. The app suggests saving an alternative for the next shop.”

Tap `Save for next shop`, close the scanner and show `Saved options`.

“This is now a real action, not only copy. The option remains after reload on this device and the save signal can be measured separately from retailer clicks. The proof of concept deliberately avoids an account or cross-device sync.”

## Close

“What this proves today is broad package naming, a constrained verified nutrition layer and a source-aware retailer action. The next validation is whether people trust the exact match, compare visible products and use the save or retailer actions. Real-store accuracy, price-label association, latency and monetization remain separate tests.”

Suggested final line:

> We can name an ordinary package, build a source-aware Sugar.no view and check an online offer in one camera flow. The Latvia prototype indexes 19,076 Barbora pages, gives ten curated products a full three-signal badge and can create a transparent two-signal quick view for other exact food pages. The next validation is real-store identity and result coverage, not a claim that all indexed pages are rated foods.

## If recognition fails live

Say: “This is why the investor path includes deterministic scenes through the same API. The live model is being benchmarked separately, and below-threshold frames intentionally return `Not sure`.” Then continue with `Shelf photo`.
