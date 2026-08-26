# Scanner design reference

The redesign uses two public interaction references without copying their branding or interface verbatim.

- [Checkit on the Latvia App Store](https://apps.apple.com/lv/app/checkit-ai-allergen-scanner/id6740466800): camera-first product recognition, several shelf annotations visible at once, a compact result surface and secondary saved picks.
- [Lóvi scanner demonstration](https://www.linkedin.com/posts/ashagraev_aiindermatology-skincareinnovation-digitaldermatology-ugcPost-7495834066324221952-YY9y/): clear selected-object focus and an explicit visual cue for what will be recognized.

Sugar.no applies those patterns to relative protein and total-sugar comparison. It uses the same product language as the main app: `Great fit`, `Moderate fit` and `Low fit` describe the two-factor comparison and never label food as good, bad, healthy or unhealthy.

## Sugar.no brand palette

The scanner theme is sourced from the live [Sugar.no website](https://sugar.no/) tokens captured on 26 August 2026, rather than from the older beige/coral proof-of-concept palette:

- canvas `#F0F7FF`, surface `#FFFFFF`, tinted surface `#F6F5F8`, blue surface `#E5F3FF`;
- primary ink `#11131F`, dark camera chrome `#14151E`, muted copy `#525252`;
- focus/selection `#0A84FF`, deep-blue labels `#044884`, light blue `#A5D0FF`;
- warm accents `#FFB496` and `#F14E58`.

Blue is reserved for brand focus and active selection. It does not replace the scanner's evidence-backed fit semantics: Great stays green, Moderate amber and Low red. Camera controls use an 82–86% `#14151E` scrim so white labels remain readable over bright packages and price tags. Results use one pale-blue canvas, white cards and a single blue active-card outline; the hierarchy is not carried by color alone.

The broad camera pass follows the multi-product shelf pattern: it scans the complete frame, keeps at most five high-confidence distinct readable front-facing SKUs and groups repeated facings of the same SKU. The focused center retry is only a fallback after the broad pass is uncertain.

The checkout fixture must be visually unmistakable as a supermarket conveyor, not a generic dark tabletop. It uses a real project-owner checkout photo. The public copy is cropped, resized and stripped of EXIF/GPS metadata; its deterministic result names the three package identities Gemini could read and overlays all three because each now has a source-backed two-factor fit. Official manufacturer nutrition supports Sproud and Schnitzer; the chanterelle badge explicitly identifies its generic food-composition reference instead of implying an exact Stockmann record.

The compact sheet keeps a short best-first preview. Expanding it turns the recognized set into a vertical `Best fit first` list rather than another horizontal carousel. Each rated row carries its rank, plain-language fit and the two verified inputs. A product may appear briefly as `Checking online…`, but if exact nutrition cannot be confirmed it disappears from the final comparison; price-only and identity-only cards are not shown. The complete scan is capped at five high-confidence distinct SKUs so the result stays readable and automatic enrichment remains bounded.

Saved images use the same result hierarchy but not the live-camera framing decoration. A long retailer-page screenshot is read in full and through overlapping sections, then every pass is merged into one de-duplicated vertical product list. The white corner guide is intentionally absent because it does not crop a saved file and would falsely imply that content outside the guide is ignored.
