# Scanner design reference

The redesign uses two public interaction references without copying their branding or interface verbatim.

- [Checkit on the Latvia App Store](https://apps.apple.com/lv/app/checkit-ai-allergen-scanner/id6740466800): camera-first product recognition, several shelf annotations visible at once, a compact result surface and secondary saved picks.
- [Lóvi scanner demonstration](https://www.linkedin.com/posts/ashagraev_aiindermatology-skincareinnovation-digitaldermatology-ugcPost-7495834066324221952-YY9y/): clear selected-object focus and an explicit visual cue for what will be recognized.

Sugar.no applies those patterns to relative protein and total-sugar comparison. It uses the same product language as the main app: `Great fit`, `Moderate fit` and `Low fit` describe the two-factor comparison and never label food as good, bad, healthy or unhealthy.

The broad camera pass follows the multi-product shelf pattern: it scans the complete frame, can return up to eight distinct readable front-facing SKUs and groups repeated facings of the same SKU. The focused center retry is only a fallback after the broad pass is uncertain.

The checkout fixture must be visually unmistakable as a supermarket conveyor, not a generic dark tabletop. It now uses a real project-owner checkout photo. The public copy is cropped, resized and stripped of EXIF/GPS metadata; its deterministic result names only the three package identities Gemini could read and does not add fit markers without verified nutrition.

When several comparable rated products are present, `Best fit in this scan` is a small eyebrow heading above the leading product name. It is not a separate status pill and stays hidden for a one-product scan.
