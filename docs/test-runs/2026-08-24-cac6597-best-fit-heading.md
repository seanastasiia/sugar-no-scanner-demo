# Best-fit heading verification — 2026-08-24

## Tested commit

- `cac6597b3dee258dc810fe0633db36bff843a7c0`
- Branch: `main`

## Technical checks

| Check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 45/45 tests in 11 files |
| `npm run build` | Pass: Next.js production build and standalone preparation |
| Focused Mobile Safari shelf test | Pass: comparison leader label is visible inside the product heading |
| Focused Mobile Safari exact-Barbora test | Pass: a one-product result has no `Best fit in this scan` label |
| `E2E_PRODUCTION=1 npm run test:e2e` | Pass: 13/13 Mobile Safari scenarios |
| Axe WCAG A/AA checks | Pass within the shelf and entry browser scenarios |

The first production-mode browser attempt returned 10/13 because the registered PWA worker bypassed three page-level recognition mocks and reached the intentionally keyless test server. Playwright now blocks service-worker registration only inside the isolated browser test profile. The repeated production-mode run passed 13/13; the deployed PWA worker remains unchanged.

## Visual check

- Reviewed `docs/screenshots/shelf-results-mobile.png` after the browser run.
- `Best fit in this scan` is a compact green eyebrow above the brand and product name.
- The old bordered pill beneath the Sugar.no badge is gone.
- The label remains text plus a Lucide vector icon, so meaning does not depend on color alone.
- Dark mode uses a lighter green for readable contrast.

## Product checks for the owner

1. Open the deployed demo and choose `Shelf photo`.
2. Expand `View products`.
3. Confirm the leading comparable product shows `Best fit in this scan` above its brand and name, not beneath the Sugar.no badge.
4. Scan one rated product alone and confirm the label is absent.

## Production evidence

- Railway deployment `af6e629e-ec32-447e-b1ae-dc31648a992a`: `SUCCESS`.
- `GET /api/health`: `ok`, commit `d98101279865b9e53d1b83f8307c2dd9040c3009`.
- Production Mobile Safari smoke: `Best fit in this scan` appeared exactly once inside the product heading, and the selected result retained one Sugar.no badge.
