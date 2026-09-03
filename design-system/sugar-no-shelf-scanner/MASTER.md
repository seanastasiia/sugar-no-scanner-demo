# Sugar.no Scanner — approved Pen design

Source: the user's approved `/Users/anastasiia/Documents/untitled.pen`, saved 3 September 2026 at 12:58 Riga time. Boards: `G9pVK`, `K9WJy`, `FfOrG`. Figma source: file `mY0Ihk460tvTRGLK1RyTmy`, scanner node `10883:59336`; outlined fit variants `15667:154340–154342`. This specification supersedes the previous coral/Inter staging skin.

## Foundations

| Role | Value |
| --- | --- |
| Canvas / tinted card | `#F2F2F7` |
| Card | `#FFFFFF → #FAFAFC`, white 1 px inset rim |
| Ink / muted | `#262626` / `#60606A` |
| Action blue / retry coral | `#0A84FF` / `#F14E58` |
| Primary button | 56 px minimum; pill; `#1A1A1A → #4D4D4D`; white → 2% white → white diagonal rim, 1.5 px; black 13% shadow, y 3.246 / blur 19.478 |
| Scan again | `#0A84FF → #9BC7F5`; shared 1.5 px white gradient rim; 20 px white refresh icon on the left; 56 px minimum height |
| Secondary action | White pill, blue label, 44 px minimum |
| Fit chip | Compact 24 px with 12 px label (`Moderate`); regular 30 px, radius 24, padding 4/8, 15/22 semibold rounded; white gradient rim 1.25 px |
| Great / Moderate / Low | `#50D671 → #2DBC51` / `#FFC917 → #FF7701` / `#F17E5B → #F93A00` |
| Cards | Radius 32; 16–24 px content gutters; 8/12/16/24 spacing |
| Text | Rounded headings 28/34, welcome 34/40; body 16/22 regular system face; small copy 12–14 |

Headings, buttons, fit and short labels use `ui-rounded`, SF Pro Rounded where available, then the system fallback. Body uses `-apple-system`, BlinkMacSystemFont, Segoe UI, sans-serif. Apple Safari uses the intended system faces. No Apple font binaries are bundled. Other browsers may differ typographically. The approved light theme is stable across system themes. Increased-contrast mode darkens chip text and action blue; normal-mode source colors are not claimed to meet full AA contrast.

Use the official SVG proportions. The existing white SVG stays white over the live feed and renders in ink on light headers elsewhere. Product packshots for the four approved demo SKUs are local; all other products use their source-backed identity/images and scene-crop fallback.

## Screen mapping

| Pen screen | Runtime surface |
| --- | --- |
| 01 `WWm4o` Welcome | `PilotOnboarding`; real clean shelf + native overlays; one 3.2 s sweep |
| 02 `d6Pdh`, 03 `Hr0OH` Aim / reading | Live stream or held frame; neutral local candidate boxes before verified results |
| 04 `BmBpL` Compact | Four leading results, 2×2 grid; Scan again / View all |
| 05 `qMiRn`, 06 `WaJO0` List / detail | Ranked product cards; detail with fit, source nutrition, exact saving, source link |
| 07 `KMksd` Demo chooser | Shelf, Checkout, saved photo; full-screen light surface |
| 08 `qg85c`, 09 `Hvd7y` Saved photo / Checkout | Rounded adaptive media, contain geometry, back-to-live action |
| 10 `d0Do2i`, 11 `w08Z4` Camera errors | Recovery panel and explicit camera retry |
| 12 `L5Xuf1` Recognition retry | Neutral explanation + coral retry |
| 13 `kMVPj`, 14 `JqIU1` Nutrition pending / unknown | Identity-first skeleton; unknown stays neutral and unscored |
| 15 `b3qRd9`, 16 `B1rYl` Offline / unavailable | Recovery panel; matching offline navigation fallback |
| 17 `EdasX`, 18 `qhp4K` Feedback / Needs work | White 370 px maximum dialog, rating, reasons and optional comment |
| 19 `ZtBQ6`, 20 `C4x6dO`, 21 `UWwfO` Saving / error / success | Locked form; retained answer on retry; success + Done |

The welcome distributes header, introduction, preview and actions with 24 px minimum gaps; short screens reduce the photo height. Compact packshots are 48 px (32 px at widths up to 360 px), and the detail packshot is square up to 290 px. The list includes verified protein and separates informational prices from the fit row. Feedback uses 8 px internal gaps, a fixed header/footer and scrollable body sized to the visual viewport; the success mark is green with a white check.

Runtime content can be longer or use a different source/price than the static examples. Exact Carbs and eligible Better alternatives remain visible even when absent from a sample frame. The runtime uses actual packshots and verified per-100 nutrition; generic placeholder images and example numbers in Pen are not product evidence. A tablet uses a side result pane; phone landscape keeps the primary compact actions visible. Live camera and held frames fill the viewport with centered object-cover mapping; photo/demo overlays retain object-contain mapping. Capture dimensions remain independent of CSS.

Owner camera correction, 3 September 2026: live video fills the browser content area behind a transparent header and white logo. Dark overlay pills keep feedback, Show demo and one bottom status readable, with safe-area insets. Remove the secondary “The scan starts…” caption. Recovery and expanded results retain the light theme.

Owner correction, 3 September 2026: rated camera/photo overlays use colored outlines and icon discs only. Do not show a floating fit-text pill, even on the selected product. Keep the full fit label in the accessible marker name and result cards.

Owner action correction, 3 September 2026: use the button finishes from Figma `15128:89227` (meal details footer). Compact Scan again is blue with a refresh icon; View all uses the black primary gradient. Keep both labels white, a 12 px gap and equal flexible columns so Scan again fits. At widths up to 360 px use 15 px labels and 12 px horizontal padding.

Owner price correction, 3 September 2026: every confirmed cheaper-online card uses one black-gradient button. Label on the left; old shelf price in white regular 13/18 with a strike-through and online price in white bold 17/22 on the right, aligned on the baseline with an 8 px gap (5 px on narrow phones). Keep the pair together. Reuse this action in details and eligible alternatives; do not separate the prices above an Open retailer action.

Owner typography correction, 3 September 2026: Buy online and Buy cheaper online use the same rounded semibold label, 600 weight and 17/22 px (15/22 px up to 360 px screen width). Nested strong labels inherit the button font instead of becoming extra bold.

Owner carousel correction, 3 September 2026: Better alternatives scroll horizontally inside the same content gutters as surrounding cards. Show one full card plus 30% of the next with a 12 px gap; card width is (available width - 12 px) / 1.3. Use native overflow scrolling and proximity snapping, keyboard focus, and no negative side margins. The last card must scroll completely into view. Wrap long names and headings; only the next-card preview is intentionally clipped.

## Interaction and validation

Motion: 180 ms surface fades and 260 ms content/sheet entrances with `cubic-bezier(0.22, 1, 0.36, 1)`, 10–24 px travel, and a 12 px horizontal detail entrance. Ranked/preview cards use a 30 ms stagger capped at 90 ms. Button presses scale to 0.985 with a 160 ms release. Only opacity and transforms animate; no layout dimensions, video or detection coordinates. Entrance effects run on navigation/mount, not every data refresh. Reduce Motion removes these effects, spinner and shimmer; navigation and focus never wait for an animation to finish.

Use semantic buttons, 44 px touch targets, focus rings, modal focus trapping, Escape close and return focus. Unknown values stay unknown. A saving action requires exact identity and an online offer below the observed shelf price. Prices never affect fit. Reduced motion removes decorative animation. Do not force a device-mask border radius onto the live web viewport.

Check the full Mobile Safari suite, the small/large-phone + tablet matrix, source-backed nutrition and offer gates, progressively resolved identities, feedback failure/retry, and comparison screenshots against Pen. Real-store camera accuracy remains an owner/device check.
