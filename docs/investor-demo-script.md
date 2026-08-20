# Investor demo script

Target length: 2–3 minutes. Use the deterministic shelf and checkout scenes for the meeting; use live camera only as an optional bonus after the guaranteed flow.

## Opening

“The hypothesis is simple: make a shelf understandable before purchase, then remain useful after purchase. This is computer vision with an AR-style overlay, not VR.”

Show the private access screen and enter the code.

“For this Latvia proof of concept we deliberately constrained the problem to 40 protein snacks. The model is allowed to identify only those products. It never invents nutrition.”

## Shelf

Tap `Shelf scene`.

“One camera view compares what is visible without asking the user to choose protein, fiber or sugar first. Sugar.no Match weights all three equally within this category. It is transparent and non-judgmental: no food is marked bad or forbidden.”

Tap two product boxes and show the inputs.

“If fiber is not independently verified, there is no total Match. We prefer a missing score over false precision.”

Open a similar option.

“Recommendations are ranked by similarity and Match. Commercial availability never changes the recommendation.”

Open the Barbora CTA, then return.

“The retailer action is deliberately secondary. We link to the exact item and ask the user to check the current price. We do not claim it is cheaper and we do not claim affiliate revenue that does not yet exist.”

## Checkout

Tap `Checkout scene` and let the four products pass.

“At checkout, the product behavior changes. We do not tell someone to undo a purchase or shame the basket. The app saves a potentially better-fit alternative for next time and de-duplicates repeated detections.”

## Close

“What this proves today is the experience, the constrained catalog and the data/privacy contract. The next validation is not ‘can AI recognize every grocery item?’ It is whether people compare visible products and whether they use the save or retailer actions. Real shelf accuracy, latency and monetization remain separate tests.”

Suggested final line:

> We can make the shelf understandable before purchase and useful after purchase. One camera shows a transparent Sugar.no Match, compares visible products and lets users save or find an alternative online. The Latvia prototype recognizes a deliberately constrained catalog of 40 products; the next validation is whether people use the comparison and retailer actions, not whether AI can recognize every grocery product immediately.

## If recognition fails live

Say: “This is why the investor path includes deterministic scenes through the same API. The live model is being benchmarked separately, and below-threshold frames intentionally return `Not sure`.” Then continue with `Shelf scene`.
