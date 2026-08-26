# Project cleanup release — 26 August 2026

## Scope

- Preserve the current investor-demo behavior while reducing active code and documentation.
- Remove the retired nutrition-label follow-up from client, API, Gemini prompt and tests.
- Split result rendering, deterministic demo scenes, image preparation and detection merging out of the two largest runtime files.
- Keep generated screenshots and superseded release logs out of the active repository; Git history remains the archive.
- Add a short architecture map and proportional change lanes so routine edits require less context and fewer checks.

## Technical checks

Baseline: `origin/main` at `97f97b9`.

| Check | Result |
| --- | --- |
| `npm ci` | Pass; 500 packages, 0 vulnerabilities |
| `npm run check:fast` | Pass; lint, typecheck, 29 test files and 148 tests |
| `npm run verify` | Pass; lint, typecheck, 148 tests and Next.js production build |
| `CI=1 npm run test:e2e` | Pass; 25/25 Mobile Safari scenarios |
| `git diff --check` | Pass |
| Dead-code scan | Only `public/sw.js` reported; retained because it is registered by URL at runtime |

## Size and structure

- Tracked working tree: 14.37 MiB → 5.85 MiB, down 8.52 MiB (59%).
- `src/components/scanner-app.tsx`: 1,939 → 1,366 lines.
- `src/server/recognition.ts`: 1,060 → 718 lines.
- Twelve generated Playwright screenshots now write to ignored `test-results/`.
- Seven superseded release logs were removed from the active tree and remain recoverable from Git history.

## Product check

1. Open production on iPhone Safari and allow camera access.
2. Open Shelf demo and Checkout demo; confirm markers and compact ranked cards appear.
3. Expand `View all`; confirm the best-first list and strict `Better alternatives` behavior remain unchanged.
4. Upload a saved shelf photo; confirm the merged result contains at most five distinct rated products.
5. Scan an unresolved product; confirm no nutrition-label action or invented rating appears.

## Production evidence

- GitHub `main`: `4d9a0ef79df7542ce1bc93c56d7bb4395d8eb1a1`.
- Railway deployment: `3290d309-d48e-496f-a62e-92c4287a5590` — success.
- `/api/health`: `status=ok` and the same commit SHA.
- `/`: HTTP 200.
- `sample-shelf`: `matched`, four distinct products.
- `sample-conveyor`: `matched`, three distinct products.
- Railway emitted a config-as-code deprecation warning; migration before 1 December 2026 is tracked in `Bugs.md`.
