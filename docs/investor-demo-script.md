# Investor demo script

Target length: 2–3 minutes. Use the deterministic shelf and checkout scenes for the meeting; use live camera only as an optional bonus after the guaranteed flow.

## Opening

“The hypothesis is simple: make a shelf understandable before purchase, then remain useful after purchase. This is computer vision with an AR-style overlay, not VR.”

Open the public link. The camera-first scanner appears immediately; if camera permission is not available, `Show demo` remains visible.

“For this Latvia proof of concept we indexed 9,707 active non-adult Barbora food products. 7,433 exact pages — 76.57% — already contain the source-backed energy, protein and total sugar needed for an automatic Sugar.no fit. The original 40 snacks remain a deterministic category benchmark, not the scanner's coverage ceiling. The model never invents nutrition.”

## Shelf

Tap `Show demo`, then `Shelf demo`.

“One camera view compares what is visible without asking the user to choose a goal first. Compact markers sit directly over the products in the shelf image. A green check, yellow minus and coral alert make the comparison scannable; Great fit, Moderate fit and Low fit carry the same meaning without relying on color alone.”

Tap two product boxes and show the Sugar.no badge.

“Instead of an unexplained score such as 86, the card shows protein and total sugar separately. We removed fiber from this version because retailer pages often do not list it. The curated badge is a relative comparison inside the protein-snack catalog; outside it, the same two factors use transparent reference bands from the exact retailer page.”

Open a similar option.

“Better alternatives appear only when Sugar.no finds the same exact product type with an equal or better fit and a current exact online offer. If there is no true substitute, we show nothing.”

Open the Barbora CTA, then return.

“The retailer action is deliberately secondary. If the camera can associate a shelf label with an exact package, its price appears under the recognized product and we check the live Barbora page. We cross out the shelf price and say `Buy cheaper at Barbora` only when the exact online SKU is genuinely cheaper. With one retailer this is a Barbora price check, not the best price, and we do not claim affiliate revenue that does not exist.”

For the optional live-camera moment, first show several different products across one shelf and explain that the broad pass scans the whole frame rather than only the center. Before the AI answer, neutral dashed regions may appear as aiming feedback; they are not product ratings. When `Reading visible products…` appears, the exact submitted frame stays visible while recognition finishes, so moving the phone cannot detach the result boxes from the analyzed shelf. Then show several facings of one SKU: repeated cans count as one product type. Use `Scan again` before demonstrating a different shelf.

## Checkout

Return to live camera, tap `Show demo`, then `Checkout demo`.

“Checkout uses exactly the same comparison behavior as the shelf: one view of the real conveyor belt beside the cashier, three detected products and three colored overlays on the image. The expanded view puts the two Great fits before the Moderate fit and shows the Protein/Sugar evidence. Sproud and Schnitzer use manufacturer nutrition; the chanterelles use a clearly labelled generic food-composition reference. We do not tell someone to undo a purchase, shame the basket or add another action to save a product.”

## Close

“What this proves today is broad package naming, a constrained verified nutrition layer and a source-aware retailer action. The next validation is whether people trust the exact match, compare visible products and use the retailer action. Real-store accuracy, price-label association, latency and monetization remain separate tests.”

Suggested final line:

> We can name an ordinary package, build a source-aware Sugar.no view and check an online offer in one camera flow. The Latvia prototype ships a local index of 9,707 active Barbora food products, with automatic Protein/Sugar fits available for 7,433 exact pages. The next validation is real-store identity accuracy across those candidates; 76.57% is catalog-data coverage, not a claim that every package on every Latvia shelf will be recognized.

## If recognition fails live

Say: “This is why the investor path includes deterministic scenes through the same API. The live model is being benchmarked separately, and below-threshold frames intentionally return `Not sure`.” Then tap `Show demo` and continue with `Shelf demo`.
