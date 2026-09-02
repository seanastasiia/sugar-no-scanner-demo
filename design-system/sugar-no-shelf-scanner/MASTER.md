# Sugar.no Shelf Scanner design system

This file records the verified visual language already used by Sugar.no. It replaces the generic generated recommendation and is the source of truth for onboarding, camera, demo, results, and feedback surfaces in this staging branch.

## Brand

- Use the official `/brand/sugar-no-logo-white.svg` asset. Do not recreate the wordmark with text, recolor it, or change its proportions.
- Place the white wordmark only over the dark scanner surface or an ink-colored brand plate with clear space.
- Product language is calm and factual. Avoid medical claims, judgmental labels, and decorative copy.

## Tokens

| Role | Token | Value |
| --- | --- | --- |
| Product canvas | `--canvas` | `#f3f4f8` |
| Primary surface | `--surface` | `#ffffff` |
| Tinted surface | `--surface-tinted` | `#f5f5f7` |
| Scanner canvas | `--scanner-canvas` | `#11131f` |
| Primary ink | `--ink` | `#11131f` |
| Muted text | `--muted` | `#69696f` |
| Primary action | local coral | `#c63f45` |
| Primary action hover | local coral dark | `#b7373e` |
| Primary action soft | local coral tint | `#fff0ed` |
| Positive fit | local green | `#15804a` |
| Divider | `--border` | `#e8e9ef` |
| Focus | `--focus` | `#0a84ff` |

The scanner's fit colors retain their existing semantic meaning. Price does not affect fit.

## Typography

- Use the existing local stack: `Inter` for body and controls, `Inter Tight` for display headings.
- Headings use tight tracking without oversize marketing typography inside the scanner.
- Body copy is at least 14 px, controls at least 12 px with strong weight, and supporting text at least 11 px.

## Shape and spacing

- Follow a 4/8 px rhythm. Standard gaps are 8, 12, 16, 20, and 24 px.
- Primary actions are pill-shaped. Cards and bottom sheets use 18 to 30 px radii.
- Every interactive target is at least 44 by 44 px. Adjacent targets have at least 8 px between them.
- Camera overlays are dark translucent pills. Feedback is a labeled coral pill, never an icon-only action.
- Modal scrims use 52 to 56 percent black plus restrained blur. Modal content must not compete with the camera behind it.

## Components

### Camera header

- Official white logo at the top left.
- `Leave feedback` and `Show demo` or `Back to live` are labeled pills over the media.
- The camera image remains primary. Controls must not obscure recognized packages or change capture geometry.

### Demo chooser

- Use the light product canvas and white option cards.
- Each option has one Lucide outline icon inside a coral-soft tile, a short title, and one line of supporting copy.
- `Back to live camera` is the coral primary action.

### Results

- Keep the light bottom-sheet hierarchy and existing exact-source nutrition presentation.
- Preserve the compact ranking, product imagery, fit semantics, and clear expanded/collapsed behavior.
- Primary actions may use coral; commercial retailer actions retain their existing green or ink treatment.

### Feedback

- Entry action reads `Leave feedback` and includes the existing Lucide message icon.
- Helpful and Needs work are equal-width choices with at least 12 px between them.
- Keep at least 20 px between the rating choices and the submit action or next form section.
- Selected state uses a coral border and soft coral surface. Loading, success, error, disabled, and retry states remain explicit.

## Motion

- Use motion only to explain state or hierarchy.
- Standard UI feedback is 150 to 300 ms with ease-out entry and ease-in exit.
- The onboarding scan line makes one 1400 ms pass. It never loops.
- Preserve `prefers-reduced-motion`: remove decorative motion and keep the product usable.
- Loading spinners may loop only while work is actually in progress.

## Responsive and accessibility contract

- Verify 375 px portrait and phone landscape, plus one large-phone viewport.
- No horizontal page overflow or controls under safe areas.
- Keep visible focus treatment, semantic buttons and dialogs, focus trapping, Escape close, and meaningful image text.
- Support enlarged text without hiding primary actions.
- Maintain at least WCAG AA text contrast and do not rely on color alone for fit or control state.
