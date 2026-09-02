# Amplitude staging analytics — test log

Date: 2026-09-02 (Europe/Riga)

Branch: `stage/onboarding-feedback`

Production safety:

- production remains on `d127ef8275d81c3d8e725a70096a3956254315d5`
- Amplitude organization `tiny-voice-226231`, EU project `Shelf Scanner - Staging` (`100054994`)
- no Stage 1 merge or deployment to production

## Data contract

- Supabase remains the full metadata-only audit store.
- Amplitude uses the EU HTTP V2 endpoint and the existing anonymous pilot session UUID as `device_id`.
- The Supabase event UUID is reused as Amplitude `insert_id` for deduplication.
- Only approved funnel properties are mirrored. Photos, OCR, comments, email, exact product IDs, and raw user-agent strings are excluded.
- Amplitude timeout or failure is non-blocking after Supabase succeeds.

## Technical verification

- targeted Amplitude and event-route tests: passed; 2 files, 6 tests
- `npm run verify`: passed; lint, typecheck, 48 test files and 246 tests, catalog validation, production build
- `CI=1 npm run test:e2e`: passed; 33/33 Mobile Safari scenarios
- implementation commit `b8062f732301332273914d782439746edd281bfc` pushed to the GitHub staging branch
- Railway staging deployment `6df98364-87a4-4047-9953-c3f94329a405`: `SUCCESS`
- staging `/api/health`: `ok`, implementation commit `b8062f732301332273914d782439746edd281bfc`
- live Amplitude readback: `app_opened`, `onboarding_started`, and `onboarding_step_viewed` received as anonymous Web events
- production `/api/health`: `ok`, unchanged commit `d127ef8275d81c3d8e725a70096a3956254315d5`

## Completed-scan delivery regression — 2026-09-02

- While constructing the activation funnel, the live demo produced `scan_started` but not `scan_completed`.
- Railway HTTP evidence showed one `/api/events` request returning `503` while adjacent event requests returned `200`.
- Root cause: `scan_events.product_id` references the managed `products` table, but the demo and external retailer layers use valid identities that are not guaranteed to exist there.
- Fix: store the bounded observed identity in Supabase JSON metadata, keep the relational foreign-key field null, and continue excluding all product identities from Amplitude.
- targeted Amplitude and route regression: passed; 2 files, 7 tests
- `npm run verify`: passed; lint, typecheck, 48 test files and 247 tests, catalog validation, production build
- `CI=1 npm run test:e2e`: passed; 33/33 Mobile Safari scenarios
- Railway staging deployment `973c02b6-08bc-4ecb-84c8-e83670e50b92`: `SUCCESS`
- staging `/api/health`: `ok`, fix commit `4b93bb61d6f2d3f47bb22f7a6c81b9b15367ed4d`
- repeated Shelf demo: product result visible; Amplitude Live Events received both `scan_started` and `scan_completed`
- production `/api/health`: `ok`, still unchanged on `d127ef8275d81c3d8e725a70096a3956254315d5`

## First saved funnel

- chart: `Shelf Scanner Activation: Open → Scan Completed`
- steps: `app_opened` → `scan_completed`
- conversion window: one day; counting by unique users
- saved URL: `https://app.eu.amplitude.com/analytics/tiny-voice-226231/chart/e-knlpkj8m?sharingId=LqRl7BUh`
- Amplitude Starter blocked a third funnel step behind the Growth upgrade; intermediate events remain available in Live Events and separate charts

## Product QA

1. Open staging with `?onboarding=1` and complete or skip onboarding.
2. In Amplitude Live Events, confirm `onboarding_started`, `onboarding_step_viewed`, and the selected completion event arrive without personal or product data.
3. Allow or deny camera access and confirm the matching permission event appears.
4. Run one real or demo scan and confirm `scan_started` and `scan_completed` appear with source, recognized count, and latency bucket.
5. Submit feedback and confirm `feedback_submitted` contains only `helpful`; the reason and optional comment must remain only in Supabase.
6. Confirm the scanner still works if Amplitude ingestion is unavailable.
7. Confirm production remains unchanged and sends no events to the staging Amplitude project.
