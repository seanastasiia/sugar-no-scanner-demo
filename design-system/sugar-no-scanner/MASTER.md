# Sugar.no scanner experimental visual study

Status: archived and inactive. This file documents the rejected Figma/Pen experiment; it is not the source of truth for the production scanner. Page-specific notes in `pages/` describe the same inactive study.

## Provenance

- Source: the supplied local `sugar .fig` file.
- Extraction: local-only; the source file was not uploaded to Figma, Pen or another cloud service.
- Editable Pen reference: `design/sugar-no-scanner.pen`.
- Web implementation: Apple system fonts and checked-in first-party Sugar.no assets.
- Restore point before this visual pass: Git tag `pre-pen-style-2026-08-25`.

## Foundations

| Role | Value | Usage |
| --- | --- | --- |
| System background | `#F2F2F7` | Page and expanded sheet background |
| Surface | `#FFFFFF` | Cards, controls and comparison panels |
| Primary text | `#000000` | Titles and important values |
| Secondary text | `#636366` | Hints, provenance and supporting copy |
| System border | `#C7C7CC` | Quiet dividers and card outlines |
| Brand coral | `#F14E58` | Sugar.no identity and retailer CTA only |
| Action coral | `#B4232D` | Accessible buttons with white text |
| Brand soft | `#FFF0F1` | Coral-tinted deal and identity surfaces |
| Great fit | `#34C759` | Positive relative fit state |
| Moderate fit | `#FFCC00` | Middle relative fit state |
| Low fit | `#F14E58` | Lower relative fit state with text/icon support |

Coral is both the source brand color and the lower-fit state in the supplied design. Context, icon and label must always make the meaning explicit; color alone is insufficient.

## Typography

- Product source: SF Pro and SF Pro Rounded.
- Web system stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Rounded headings: `ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Pen preview: Inter and Nunito Sans are visual substitutes because Pen does not expose SF Pro directly.
- Do not use Playfair, Georgia or another editorial serif in the scanner.

## Shape and spacing

- Core spacing: 12 px and 16 px.
- Compact controls: 44 px minimum height and fully rounded.
- Cards: 18–24 px radius.
- Mobile result sheet: 40 px top corners.
- Full-screen mobile frame: 40 px in Pen; the browser uses the device viewport itself.
- Shadows are reserved for sheet separation and camera overlays. Cards use a system border before a shadow.

## Component rules

### Camera controls

- Use black translucent capsules with white icon and text over the scene.
- Keep the real camera/photo visually dominant.
- Fit markers use one state-colored outline and one state-colored icon circle. Do not add a white selected ring.
- Identified-but-unrated packages remain in the result list and receive no camera marker.

### Results sheet

- Collapsed state shows count, best-first summary, `View all` and horizontally scrollable previews.
- Expanded state becomes a dedicated full comparison page with a vertical ranking.
- Surface hierarchy: system gray page, white cards, colored state fills only inside meaningful chips/signals.
- Use rounded headings and compact system body text.

### Fit and nutrition

- Public taxonomy: `Great fit`, `Moderate fit`, `Low fit`.
- Current fit inputs: Protein and total Sugar per 100 g.
- Never show internal numeric percentiles or `2/2 signals` on the camera.
- State always includes label plus check, minus or down-arrow icon.

### Price comparison

- Cross out a shelf price only for an exact current cheaper Barbora offer.
- Deal surface uses brand-soft coral; buttons with white text use the darker action coral so compact labels meet WCAG AA.
- No trusted physical price means no crossed-out comparison.

## Motion and accessibility

- Transitions: 180–240 ms, opacity/background/border only.
- Respect reduced motion.
- All targets are at least 44 × 44 px.
- Keep a visible blue system focus ring for keyboard use.
- Support 320 px minimum width, iPhone portrait/landscape, safe areas and enlarged text.
- The investor demo stays in the light Sugar.no visual system even when the device uses dark mode.

## Forbidden drift

- No cream/brown editorial palette.
- No serif display headings.
- No generic pink/purple SaaS examples.
- No colored legend repeated above every result.
- No white marker rings or decorative crop corners on saved photos.
- No food-shaming words or absolute health verdicts.
