# Checkout demo active-camera race — 25 August 2026

## Correction of prior evidence

`docs/screenshots/checkout-mobile.png` is an automated local Mobile Safari fixture screenshot. It proves the intended deterministic checkout layout, but it did not prove that production could reach the same state when a real live-camera recognition request was already in flight. The project owner then reproduced a production failure: Checkout photo remained on a loader and changed to `Trying a closer center read…` with no product results.

## Root cause

The live-camera request occupied the single shared recognition slot. Selecting Checkout stopped the media stream but did not abort that fetch or clear the slot, so the deterministic `sample-conveyor` request was skipped. When the old camera response arrived, it was still allowed to update the new checkout scene and started the focused-camera retry state.

## Fix

- Behavior commit: `1c79f920609a2c5f20b586984dfd17fe07a17337`.
- Every recognition run now owns an `AbortController`.
- Changing source to Shelf, Checkout, saved image or a new camera session aborts the unfinished fetch, clears the slot and prevents its stale completion from changing UI state.
- Upload multi-pass requests share the same cancellation boundary.

## Technical verification

| Check | Result |
| --- | --- |
| Pre-fix regression | Failed exactly as reported: expected checkout result, received `Trying a closer center read…` |
| Post-fix targeted Mobile Safari regression | Pass: delayed camera read cancelled/ignored, three checkout fits remain after its former completion time |
| `npm run verify` | Pass: lint, typecheck, 20 Vitest files / 111 tests, production build and standalone preparation |
| `CI=1 npm run test:e2e` | Pass: 23/23 Mobile Safari scenarios |
| Railway behavior deployment | `cc6ab6e0-ad99-4145-909c-411be0c1ffed` — `SUCCESS` |
| Production `/api/health` | `status=ok`, commit `1c79f920609a2c5f20b586984dfd17fe07a17337` |

## Production transition smoke

A production Mobile Safari session started one synthetic live-camera recognition request and held its response for 1.5 seconds. While it was in flight, the session selected `Show demo` → `Checkout demo`. Production sent one separate checkout request and reached the deterministic result. The check then waited beyond the delayed camera response window.

Final production DOM state:

- status: `3 products · 3 with Sugar.no fit`;
- checkout markers: 3;
- stale `Trying a closer center read…`: absent;
- compact results: Sproud `Great fit`, Stockmann `Great fit`, Schnitzer `Moderate fit`.

This validates the previously missing transition. It remains an automated production browser check with a controlled camera stream, not a physical-device camera accuracy benchmark.

## Product-owner check

1. Fully reload the production page so the new JavaScript bundle is active.
2. Let live recognition begin, then immediately open `Show demo` → `Checkout demo`.
3. Confirm the loader resolves to three product markers and `3 products · 3 with Sugar.no fit`.
4. Wait at least three seconds. The result must stay visible and must not change to `Trying a closer center read…`.
