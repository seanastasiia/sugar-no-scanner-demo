# One-tap Barbora deal verification — 2026-08-24

## Tested commit

- `fcad26e0ac0f61ff79aa38497c161d33fc9b13f0`
- Branch: `main`

## Technical checks

| Check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 45/45 tests in 11 files |
| `npm run build` | Pass: Next.js production build and standalone preparation |
| Focused Mobile Safari price test | Pass |
| `E2E_PRODUCTION=1 npm run test:e2e` | Pass: 13/13 Mobile Safari scenarios |
| Axe WCAG A/AA checks | Pass within the shelf and entry browser scenarios |

## Guardrails verified

- A trusted €1.69 shelf price plus an exact €0.99 Barbora SKU exposes a compact `Buy cheaper` link.
- The link opens the exact SKU URL and has a touch target at least 44 px high.
- A possible retailer match exposes no compact purchase link.
- A frame without a trusted shelf label exposes no compact purchase link.
- The existing expanded comparison still crosses out only the shelf price and retains its exact `Buy cheaper at Barbora` link.
- No Save action or persisted shopping list was reintroduced.

## Visual check

- Reviewed `docs/screenshots/price-cta-compact-mobile.png`.
- The recognized product and crossed-out shelf price remain on the left.
- The contrasting right-side action shows `Buy cheaper` and the current Barbora price without covering the camera with a larger sheet.
- The action uses text plus a Lucide external-link icon and keeps a distinct interactive region from the product-details button.

## Product checks for the owner

1. Scan a product together with one clearly associated shelf label.
2. If the exact Barbora SKU is cheaper, confirm `Buy cheaper` appears directly in the compact camera sheet.
3. Tap it and confirm the exact product page opens in one tap.
4. Repeat without a shelf label or with a non-exact match and confirm no cheaper-purchase action appears.

## Production evidence

- Railway deployment `bf9c353c-2060-4e2c-8e68-60bff17f46e2`: `SUCCESS`.
- `GET /api/health`: `ok`, commit `b8393824474bd7c0836c87e6483a1818d83d0f71`.
- Authenticated production iPhone/WebKit smoke with a controlled exact-deal API response: the compact link was visible, 70 px high, targeted `_blank` and pointed directly to the expected Barbora SKU URL.
