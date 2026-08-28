# Progressive online enrichment release check

Date: 2026-08-28  
Branch: `codex/online-enrichment-release`

## Regression

Production still submitted all recognized products as one enrichment batch. The interface therefore kept every unrated card on `Checking online…` until the slowest grounded lookup completed. The earlier progressive implementation had remained on an unpublished local branch.

## Change

- Up to five detected identities are resolved independently and concurrently.
- Each exact result is merged into the visible scan as soon as its own request completes.
- The strict exact-SKU, cited nutrition and no-invention rules are unchanged.
- The API retains support for a five-product concurrent batch for non-browser clients.

## Technical checks before publish

- Targeted Vitest: `28 passed` across progressive enrichment, route and recognition coverage.
- Targeted Mobile Safari regression: `1 passed`; a fast product becomes rated while a second lookup is deliberately blocked.
- `npm run verify`: lint, typecheck, `165` unit/integration tests and production build passed.
- `CI=1 npm run test:e2e`: `25 passed` on Mobile Safari, including camera, uploaded shelf, checkout, privacy, online enrichment and accessibility paths.

## Product check

1. Scan a shelf containing several products not already rated in the local catalog.
2. Open `View all` while enrichment is running.
3. Confirm individual cards receive a fit and reorder without waiting for every other `Checking online…` card.
4. Confirm unresolved products eventually disappear rather than receiving invented nutrition.

Production commit, deployment and live smoke results are recorded below after release.
