# Investor demo script

Target length: 2–3 minutes. Use the deterministic shelf and checkout scenes for the meeting; use live camera only as an optional bonus after the guaranteed flow.

## Opening

“The hypothesis is simple: make a shelf understandable before purchase, then remain useful after purchase. This is computer vision with an AR-style overlay, not VR.”

Show the private access screen and enter the code.

“For this Latvia proof of concept we index 19,076 Barbora pages, so the camera can name ordinary packaged products. Ten curated snacks have the full three-signal category badge. For an exact food outside that set, we can now build a live two-signal quick view from the nutrition on its exact Barbora page. The model never invents nutrition.”

## Shelf

Tap `Shelf photo`.

“One camera view compares what is visible without asking the user to choose protein, fiber or sugar first. Compact markers sit directly over the products in the shelf image. A green check, yellow minus and coral alert make the comparison scannable; Great fit, Moderate fit and Low fit carry the same meaning without relying on color alone.”

Tap two product boxes and show the Sugar.no badge.

“Instead of an unexplained score such as 86, the card shows protein, fiber and total sugar separately. The full curated badge is a relative comparison inside the protein-snack catalog. Outside it, a clearly labelled quick view uses transparent reference bands from the exact retailer page. If fiber is not listed, it stays neutral and the card says two of three — it never pretends to know.”

Open a similar option.

“Similar options scroll horizontally. They are ranked by category similarity and the internal comparison, while commercial availability never changes the recommendation.”

Open the Barbora CTA, then return.

“The retailer action is deliberately secondary. If the camera can associate a shelf label with an exact package, its price appears under the recognized product and we check the live Barbora page. We cross out the shelf price and say `Buy cheaper at Barbora` only when the exact online SKU is genuinely cheaper. With one retailer this is a Barbora price check, not the best price, and we do not claim affiliate revenue that does not exist.”

For the optional live-camera moment, first show several different products across one shelf and explain that the broad pass scans the whole frame rather than only the center. Then show several facings of one SKU: repeated cans count as one product type and the successful frame is held while the viewer reads. Tap `Scan again` before showing a different product; the new scan replaces the old one instead of accumulating it.

## Checkout

Tap `Checkout photo`.

“Checkout uses exactly the same comparison behavior as the shelf: one view of the real conveyor belt beside the cashier, four detected packages and colored overlays on the image. We do not tell someone to undo a purchase, shame the basket or add another action to save a product.”

## Close

“What this proves today is broad package naming, a constrained verified nutrition layer and a source-aware retailer action. The next validation is whether people trust the exact match, compare visible products and use the retailer action. Real-store accuracy, price-label association, latency and monetization remain separate tests.”

Suggested final line:

> We can name an ordinary package, build a source-aware Sugar.no view and check an online offer in one camera flow. The Latvia prototype indexes 19,076 Barbora pages, gives ten curated products a full three-signal badge and can create a transparent two-signal quick view for other exact food pages. The next validation is real-store identity and result coverage, not a claim that all indexed pages are rated foods.

## If recognition fails live

Say: “This is why the investor path includes deterministic scenes through the same API. The live model is being benchmarked separately, and below-threshold frames intentionally return `Not sure`.” Then continue with `Shelf photo`.
