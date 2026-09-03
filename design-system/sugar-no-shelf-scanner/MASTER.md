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
| Secondary action | White pill, blue label, 44 px minimum |
| Fit chip | Compact 24 px with 12 px label (`Moderate`); regular 30 px, radius 24, padding 4/8, 15/22 semibold rounded; white gradient rim 1.25 px |
| Great / Moderate / Low | `#50D671 → #2DBC51` / `#FFC917 → #FF7701` / `#F17E5B → #F93A00` |
| Cards | Radius 32; 16–24 px content gutters; 8/12/16/24 spacing |
| Text | Rounded headings 28/34, welcome 34/40; body 16/22 regular system face; small copy 12–14 |

Headings, buttons, fit and short labels use `ui-rounded`, SF Pro Rounded where available, then the system fallback. Body uses `-apple-system`, BlinkMacSystemFont, Segoe UI, sans-serif. Apple Safari uses the intended system faces. No Apple font binaries are bundled. Other browsers may differ typographically. The approved light theme is stable across system themes. Increased-contrast mode darkens chip text and action blue; normal-mode source colors are not claimed to meet full AA contrast.

Use the official SVG proportions. The existing white SVG is rendered in ink on the light header, without the old dark plate. Product packshots for the four approved demo SKUs are local; all other products use their source-backed identity/images and scene-crop fallback.

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

Runtime content can be longer or use a different source/price than the static examples. Exact Carbs and eligible Better alternatives remain visible even when absent from a sample frame. The runtime uses actual packshots and verified per-100 nutrition; generic placeholder images and example numbers in Pen are not product evidence. A tablet uses a side result pane; phone landscape keeps the primary compact actions visible. All camera and photo overlays use object-contain mapping, and capture dimensions remain independent of CSS.

## Interaction and validation

Use semantic buttons, 44 px touch targets, focus rings, modal focus trapping, Escape close and return focus. Unknown values stay unknown. A saving action requires exact identity and an online offer below the observed shelf price. Prices never affect fit. Reduced motion removes decorative animation. Do not force a device-mask border radius onto the live web viewport.

Check the full Mobile Safari suite, the small/large-phone + tablet matrix, source-backed nutrition and offer gates, progressively resolved identities, feedback failure/retry, and comparison screenshots against Pen. Real-store camera accuracy remains an owner/device check.
