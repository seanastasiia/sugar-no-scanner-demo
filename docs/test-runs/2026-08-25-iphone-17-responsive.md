# iPhone 17 Pro responsive release check

- Date: 2026-08-25, Europe/Riga
- Scope: keep the camera-first scanner and expanded product comparison within the visible Mobile Safari viewport across current iPhone sizes and orientation changes.

## Defect reproduced

The expanded fixed sheet used `height: 100dvh`. In WebKit, changing from a 440×956 viewport to 375×667 during the same session left the dialog bottom at 956 px. The result therefore exceeded the new visible height even though the document had no horizontal scrollbar.

## Implementation

- The camera experience fills the viewport through `inset: 0` instead of a cached viewport-unit height.
- The expanded fixed sheet uses `top: 0` and `bottom: 0`, allowing WebKit to recalculate its height immediately.
- Fixed headers, status, sheet chrome/content and demo modal include left and right iOS safe-area insets as well as top/bottom insets.
- The compact phone sheet is 158 px before the bottom safe area. On widths up to 420 px, `Scan again` becomes one accessible 44 px icon button so the title and `View all` action fit.
- Short portrait and landscape heights use smaller collapsed-sheet footprints while retaining 44 px controls.
- `text-size-adjust: 100%` prevents Safari orientation autosizing from unexpectedly widening controls.

## Technical checks

| Check | Result |
| --- | --- |
| `npm run verify` | Pass: ESLint, TypeScript, 19 Vitest files with 103 tests, Next.js production build and standalone asset preparation |
| `CI=1 npm run test:e2e` | Pass: 20 of 20 Mobile Safari scenarios in 55.8 seconds |
| iPhone 17 Pro portrait | Pass at 402×874 CSS px, DPR 3; camera, status, bottom sheet and actions stay inside the viewport |
| iPhone 17 Pro landscape | Pass at 874×402; compact sheet and camera controls remain inside the viewport |
| Large iPhone portrait | Pass at 440×956 |
| Small iPhone portrait | Pass at 375×667 |
| Resize/orientation regression | Pass: expanded dialog recalculates from 956 px to 667 px instead of retaining the old height |
| Document overflow | Pass at every matrix size; product-preview and Similar-options rails remain the only intentional horizontal scrollers |
| Touch targets | Pass: compact actions and collapse control are at least 44 px |
| `git diff --check` | Pass |

## Production release

- Application commit: `48b633b11b92a60bb07e88176fa2df75e557cc42`
- Direct Railway deployment: `ed79da46-6758-43cb-98fd-fbb7d8408012` — `SUCCESS`
- Production health: `GET /api/health` returned `status: ok` and commit `48b633b11b92a60bb07e88176fa2df75e557cc42`.
- Production WebKit smoke: pass. The compact result sheet, status, `View all` and `Scan again` fit 402×874 with no document overflow. The expanded dialog ended exactly at 874 px, then recalculated to 402 px after landscape rotation and to 667 px after the following narrow-portrait resize.

## Visual evidence

- `docs/screenshots/iphone-17-pro-camera.png`
- `docs/screenshots/iphone-17-pro-results.png`
- `docs/screenshots/iphone-17-pro-landscape.png`

## Product check after deployment

1. Open production Safari on an iPhone 17 Pro and allow the camera.
2. Open Shelf demo and confirm the camera remains the dominant surface; the bottom sheet must show `View all` plus one `Scan again` icon without clipped text.
3. Expand results and rotate to landscape, then back to portrait. Confirm the sheet immediately fits the current visible browser height.
4. Collapse results and confirm the status pill remains above the sheet and every fixed control clears the notch, Dynamic Island, home indicator and rounded side safe areas.
5. Increase Safari Page Zoom once and confirm titles wrap or truncate inside their cards without widening the page.

Automated WebKit reproduces the CSS viewport and orientation behavior but does not replace the final physical-device Safari check with real browser chrome and the user's accessibility/display settings.
