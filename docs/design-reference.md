# Scanner design reference

The redesign uses two public interaction references without copying their branding or interface verbatim.

- [Checkit on the Latvia App Store](https://apps.apple.com/lv/app/checkit-ai-allergen-scanner/id6740466800): camera-first product recognition, several shelf annotations visible at once, a compact result surface and secondary saved picks.
- [Lóvi scanner demonstration](https://www.linkedin.com/posts/ashagraev_aiindermatology-skincareinnovation-digitaldermatology-ugcPost-7495834066324221952-YY9y/): clear selected-object focus and an explicit visual cue for what will be recognized.

Sugar.no applies those patterns to relative protein and total-sugar comparison. It uses the same product language as the main app: `Great fit`, `Moderate fit` and `Low fit` describe the two-factor comparison and never label food as good, bad, healthy or unhealthy.

The broad camera pass follows the multi-product shelf pattern: it scans the complete frame, can return up to eight distinct readable front-facing SKUs and groups repeated facings of the same SKU. The focused center retry is only a fallback after the broad pass is uncertain.

The checkout fixture must be visually unmistakable as a supermarket conveyor beside the cashier, not a generic dark tabletop. Its environment is based on [Enkhjin photography's checkout image on Unsplash](https://unsplash.com/photos/groceries-are-on-a-conveyor-belt-at-a-checkout-jng9usOa_J0); four separate demo packs are composited onto the belt so deterministic markers still point at the products shown.

When several comparable rated products are present, `Best fit in this scan` is a small eyebrow heading above the leading product name. It is not a separate status pill and stays hidden for a one-product scan.
