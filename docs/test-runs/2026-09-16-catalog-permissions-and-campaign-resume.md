# Managed catalog permissions and Shelf campaign resume — 16 September 2026

## Change

- Added additive migration `202609160001_catalog_service_role_read.sql`.
- `service_role` receives `SELECT` on private `products` and `product_sources` only.
- `anon` and `authenticated` are explicitly denied table access.
- Runtime fallback remains available when the optional managed catalog is empty.

## Technical verification

- Implementation commit: `16ae2b8f329106073224fa06dbd8232b9f62dc3a` on GitHub `main`.
- `npm run verify`: passed with 98 test files / 816 tests, all catalog validators and production build.
- Production Supabase SQL readback: service-role reads `true` / `true`; anonymous and authenticated product reads `false` / `false`.
- Production REST request using the server-only role: HTTP 200. The managed table currently contains zero rows, so the checked-in catalog remains the expected runtime source.
- Railway deployment `2822e732-4011-4e85-bd34-8732d412b3fe`: `SUCCESS`; `/api/health` returned HTTP 200 and commit `16ae2b8f329106073224fa06dbd8232b9f62dc3a`.

## Product verification

1. Open the production scanner and complete the sample shelf flow; products should still appear from the checked-in catalog.
2. Confirm a real product scan no longer produces a Supabase permission error. An empty managed table may still log the explicit `empty_products_table` fallback.
3. In Meta Ads Manager, campaign `Shelf LV Pilot 01 | Sales | 2026-09-11` is `Active` with a EUR 70 lifetime budget and EUR 49.97 recorded spend at resume time.
4. `Static C`, `Static D` and `Video A` are `Active`; `Static B` remains `In draft` and was not published.

