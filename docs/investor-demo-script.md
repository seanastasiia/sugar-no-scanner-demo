# Investor demo script

Target length: 2–3 minutes. Use the deterministic shelf and checkout scenes for the meeting; use live camera only as an optional bonus after the guaranteed flow.

## Opening

“The hypothesis is simple: make a shelf understandable before purchase, then remain useful after purchase. This is computer vision with an AR-style overlay, not VR.”

Show the private access screen and enter the code.

“For this Latvia proof of concept we deliberately constrained the problem to 40 protein snacks. The model is allowed to identify only those products. It never invents nutrition.”

## Shelf

Tap `Shelf photo`.

“One camera view compares what is visible without asking the user to choose protein, fiber or sugar first. The colored boxes sit directly over the products in the shelf image. Green, yellow and red make the comparison scannable; the words Strong, Middle and Lower carry the same meaning without relying on color alone.”

Tap two product boxes and show the Sugar.no badge.

“Instead of an unexplained score such as 86, the badge shows the three inputs separately: protein, fiber and total sugar. These are relative comparisons inside this protein-snack catalog, not a good-food or bad-food verdict. If fiber is not independently verified, the overall state remains pending rather than pretending to know.”

Open a similar option.

“Similar options scroll horizontally. They are ranked by category similarity and the internal comparison, while commercial availability never changes the recommendation.”

Open the Barbora CTA, then return.

“The retailer action is deliberately secondary. We link to the exact item and ask the user to check the current price. We do not claim it is cheaper and we do not claim affiliate revenue that does not yet exist.”

## Checkout

Tap `Checkout photo`.

“Checkout uses exactly the same behavior as the shelf: one view of the whole belt, several detected packages and colored overlays on the image. We do not tell someone to undo a purchase or shame the basket. The app suggests saving an alternative for the next shop.”

Tap `Save for next shop`, close the scanner and show `Saved options`.

“This is now a real action, not only copy. The option remains after reload on this device and the save signal can be measured separately from retailer clicks. The proof of concept deliberately avoids an account or cross-device sync.”

## Close

“What this proves today is the experience, the constrained catalog and the data/privacy contract. The next validation is not ‘can AI recognize every grocery item?’ It is whether people compare visible products and whether they use the save or retailer actions. Real shelf accuracy, latency and monetization remain separate tests.”

Suggested final line:

> We can make a shelf or checkout belt understandable in one view. Colored overlays identify supported products, a transparent three-signal Sugar.no badge explains the comparison, and users can save or find an alternative online. The Latvia prototype recognizes a deliberately constrained catalog of 40 products; the next validation is whether people use the comparison and retailer actions, not whether AI can recognize every grocery product immediately.

## If recognition fails live

Say: “This is why the investor path includes deterministic scenes through the same API. The live model is being benchmarked separately, and below-threshold frames intentionally return `Not sure`.” Then continue with `Shelf photo`.
