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

## Product QA

1. Open staging with `?onboarding=1` and complete or skip onboarding.
2. In Amplitude Live Events, confirm `onboarding_started`, `onboarding_step_viewed`, and the selected completion event arrive without personal or product data.
3. Allow or deny camera access and confirm the matching permission event appears.
4. Run one real or demo scan and confirm `scan_started` and `scan_completed` appear with source, recognized count, and latency bucket.
5. Submit feedback and confirm `feedback_submitted` contains only `helpful`; the reason and optional comment must remain only in Supabase.
6. Confirm the scanner still works if Amplitude ingestion is unavailable.
7. Confirm production remains unchanged and sends no events to the staging Amplitude project.
