# Scanner page override

This page overrides `../MASTER.md` for the live camera, sample shelf and sample checkout experiences.

## Reference pattern

- Use Checkit's camera-first hierarchy: the scene is the primary surface, detected packages are annotated in place, and product details arrive in a compact bottom sheet.
- Use Lóvi's focus clarity: make the selected object visually unmistakable and show what the system is acting on.
- Do not copy either product's visual identity, language or branding. Keep Sugar.no cream, ink and coral as the surrounding product system.

## Scene and overlays

- Show one photorealistic source scene for both shelf and checkout samples. Checkout uses the same multi-product scan pattern as shelf.
- Keep the camera/image stage at least 60% of the initial mobile viewport when results exist.
- Every supported package gets one bounded hit target with a border and central marker.
- Marker states are `Great fit`, `Moderate fit`, `Low fit` and `Data pending`, matching the Sugar.no product taxonomy.
- State must never depend on color alone: pair green with a check, yellow with a minus, red/coral with an alert icon, and pending with an info icon. Selected state adds a white ring and visible text.
- These states are relative within the protein-snack catalog, not good/bad or healthy/unhealthy judgments.
- Never show the internal numeric comparison score in the user interface.

## Bottom sheet

- Pull the cream results sheet over the lower edge of the scene with a visible drag handle.
- First show product count and a compact best-first preview. Expanding the sheet reveals a vertical ranking, not a second horizontal carousel.
- Order complete Protein/Sugar fits from higher to lower internal score and keep `Great fit`, `Moderate fit` or `Low fit` visible on every row. Preserve stable scan order for ties. Products without a full fit must appear last as `Fit pending` without a rank number.
- The selected result contains brand/name and a `Sugar.no badge` with three criteria: Protein, Fiber and Sugar. It has no save control.
- When a trusted physical shelf label is associated with a product, show its price directly beneath that product in the compact preview, ranked row and expanded result. Cross it out only when an exact current Barbora offer is lower, then use the explicit `Cheaper at Barbora` label and `Buy cheaper at Barbora` action.
- Each criterion includes actual value per 100 g, direction text and color support.
- `Similar options` is a horizontally scrollable row of compact cards. Retailer CTA remains secondary.
- Checkout uses the same comparison pattern as Shelf and does not ask the user to undo the basket or save a product.
- Keep source provenance and prototype limitations in internal QA documentation rather than a visible `Data sources and limits` accordion in the investor flow.

## Interaction and accessibility

- All actionable targets are at least 44 x 44 px and have visible focus styles.
- Keep the header and controls legible over photos with a restrained black-to-transparent gradient and translucent control surfaces.
- Support safe areas, portrait widths down to 375 px, phone landscape, 125% text, dark mode and reduced motion.
- Avoid persistent animation, color-only meaning, horizontal page overflow and package labels that collide on narrow products.

## Demo evidence boundary

- Generated sample photos and deterministic boxes demonstrate the interaction only.
- Never present them as computer-vision accuracy evidence; real shelf and checkout benchmarks require physical test materials and the live provider.
