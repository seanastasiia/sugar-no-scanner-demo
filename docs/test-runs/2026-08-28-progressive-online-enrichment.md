# Progressive online enrichment release check

Date: 2026-08-28  
Branch: `codex/online-enrichment-release`

## Regression

Production still submitted all recognized products as one enrichment batch. The interface therefore kept every unrated card on `Checking online…` until the slowest grounded lookup completed. The earlier progressive implementation had remained on an unpublished local branch.

## Change

- Up to five detected identities are resolved independently and concurrently.
- Each exact result is merged into the visible scan as soon as its own request completes.
- An identity without a readable pack size or barcode no longer starts Open Food Facts API or grounded web searches that cannot satisfy the exact-SKU guardrail.
- Grounded web nutrition for a complete identity is capped at 6 seconds instead of 18 seconds.
- The strict exact-SKU, cited nutrition and no-invention rules are unchanged.
- The API retains support for a five-product concurrent batch for non-browser clients.

## Technical checks before publish

- Targeted Vitest: `28 passed` across progressive enrichment, route and recognition coverage.
- Targeted Mobile Safari regression: `1 passed`; a fast product becomes rated while a second lookup is deliberately blocked.
- Final `npm run verify`: lint, typecheck, `166` unit/integration tests and production build passed.
- `CI=1 npm run test:e2e`: `25 passed` on Mobile Safari, including camera, uploaded shelf, checkout, privacy, online enrichment and accessibility paths.

## Product check

1. Scan a shelf containing several products not already rated in the local catalog.
2. Open `View all` while enrichment is running.
3. Confirm individual cards receive a fit and reorder without waiting for every other `Checking online…` card.
4. Confirm unresolved products eventually disappear rather than receiving invented nutrition.

## First production evidence

- Production code commit before the fail-fast follow-up: `1c28ec4f31658f091a23d34ebe234d4ec2da794c`.
- Railway deployment: `6b23f098-0c3a-44b3-a234-bcbb455e6b1a` (`SUCCESS`).
- `/api/health`: HTTP 200 and the expected commit.
- Root: HTTP 200 in 330 ms.
- Deterministic shelf recognition: HTTP 200 in 304 ms, four detections and `imageStored: false`.
- Exact-size Pringles enrichment: HTTP 200 in 805 ms; the same identity without a pack size reproduced the regression at 17.6 seconds before the fail-fast fix.

## Final production evidence

- Code commit: `9e06baba158bb75e83a9696cbce9e95f5ba9ec61`.
- Railway deployment: `83adcdd8-72db-430b-86fe-ede507a04b17` (`SUCCESS`).
- `/api/health`: HTTP 200, exact code commit and 9,707 active food products.
- Root: HTTP 200 in 180 ms.
- The same incomplete Pringles identity that took 17.6 seconds before the fix returned in 348 ms after deploy (`serverLatencyMs: 176`, `matchKind: visual_only`, `imageStored: false`).
