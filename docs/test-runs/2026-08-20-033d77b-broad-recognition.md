# Broad recognition and price comparison verification

- Date: 2026-08-20
- Application commit under test: `033d77b`
- Environment: local macOS, Node.js, Next.js production build, Playwright Mobile Safari profile
- Production release: pending in this entry until Railway verification completes

## Automated checks

| Check | Result |
| --- | --- |
| `git diff --check` | Pass |
| `npm run catalog:validate` | Pass: 40 curated products, 10 complete Match products, 30 pending fiber, 19,076 unique Barbora slugs |
| `npm run verify` | Pass: ESLint, TypeScript, 8 Vitest files / 29 tests, Next.js production build |
| `CI=1 npm run test:e2e` | Pass: 11/11 Mobile Safari scenarios in 10.8 s |
| Price certainty regression | Pass: exact SKU crosses out a higher shelf price; possible SKU keeps the shelf price intact and says `Price check` |

The full browser run includes the private gate, deterministic shelf and checkout scenes, outside-catalog package identity, exact/possible retailer states, camera denial, saved-image fallback, local saves, narrow portrait, phone landscape, reduced motion, dark mode, enlarged text and automated WCAG A/AA checks.

## Live provider checks

The Railway Gemini secret was injected into the local process without printing or writing it to the repository. Raw images were not persisted by the application.

- Supplied `IMG_2953.PNG`: `Sanpellegrino Zero Added Sugars Pesca & Clementina` resolved to the exact Barbora SKU `gaz-dz-sanpellegrino-zero-peach-0-33-l-d`, current public offer €0.99, `exactSku: true`. Two strict-margin runs took 3,591 ms and 6,209 ms.
- Concept shelf image: six distinct front-facing packages returned; associated shelf labels €1.79 and €2.29 were read with 0.92–0.95 confidence. Total request time was 7,159 ms.
- The physical Latvia store benchmark remains open. These calls prove the integration and price-label concept, not production accuracy or p95 latency.

## Product checks still required

1. On an iPhone, scan one package by itself and confirm the correct name appears without a shutter button.
2. Scan a package and its single shelf label in one frame; confirm the shelf price appears.
3. Confirm the shelf price is crossed out only for an exact, cheaper Barbora SKU.
4. Scan several real products and price labels on one shelf and note misses, wrong variants and latency.
5. Open the Barbora action and verify flavor, pack size and current retailer price before relying on the comparison.
