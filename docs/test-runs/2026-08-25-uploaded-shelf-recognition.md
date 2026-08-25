# Uploaded landscape shelf recognition release check

- Date: 2026-08-25, Europe/Riga
- Scope: make `Use saved photo` return meaningful product and Sugar.no results for dense landscape shelf photos without attaching nutrition to an unconfirmed variant.

## Defect reproduced on the two reported photos

- Tuna shelf: HTTP 200, 8 visible product identities, 0 source-backed fits. Gemini named Rio Mare, Calvo and Kaija variants, but all remained `visual_only`.
- Biscuit shelf: HTTP 200, 6 visible product identities, 0 source-backed fits. The broad pass grouped multiple rows and flavors under generic identities such as `Selga Classic`.
- The photos were read directly from the temporary user attachment paths for this acceptance run. They are not stored by the app and are not copied into the repository.

## Implementation

- Landscape uploads use one full-frame read plus top, middle and bottom overlapping row close-ups. Portrait/focused uploads keep one request.
- Row boxes are remapped to the original uploaded photo before rendering.
- Repeated detections are merged. When a source-backed exact result overlaps a related generic visual result, the exact result wins.
- Latvian word-ending differences are matched within an already matching brand and clear candidate margin.
- Tuna/tonno/tunzivs and olive-oil vocabulary is normalized for Latvian retailer matching.
- `4x80g` can match a catalog product represented as `3+1 / 320g`; different quantities still fail closed.
- A single text-plausible Barbora candidate below exact text confidence is accepted only after Gemini compares the visible package with that one constrained packshot at confidence 0.92 or higher.

## Technical checks

| Check | Result |
| --- | --- |
| `npm run verify` | Pass: ESLint, TypeScript, 20 Vitest files with 109 tests, Next.js production build and standalone preparation |
| `CI=1 npm run test:e2e` | Pass: 21 of 21 Mobile Safari scenarios in 56.8 seconds |
| Landscape upload regression | Pass: browser sends four reads, remaps the exact row result, removes its broad overlapping duplicate and renders one rated product |
| Quantity regression | Pass: `4x80g` matches `3+1 / 320g`; different sizes remain rejected by existing tests |
| Latvian morphology regression | Pass: the exact Selga condensed-milk flavor ranks ahead of the caramel flavor |
| Privacy | Pass by architecture: only request frames are analyzed; no raw attachment was added to Git or analytics |

## Product check after deployment

1. Open production and choose each of the two reported landscape photos through `Use saved photo`.
2. Confirm the status changes to `Reading the shelf row by row…` and finishes without pressing another button.
3. Confirm several distinct packages are named and at least one exact catalog-supported product receives a Sugar.no fit when the visible variant can be confirmed.
4. Open `View all` and confirm rated products sort first. Generic/unavailable retailer products may remain `Needs nutrition label`; they must not borrow another flavor's nutrition.
5. Confirm markers align with the original full photo and repeated facings do not create repeated cards for the same exact SKU.

Production evidence is added only after GitHub main and Railway release verification.
