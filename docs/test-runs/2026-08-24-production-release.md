# Production release · public multi-product shelf scanner

Date: 2026-08-24 (Europe/Riga)

Product commit: `4c9fe5228e20b5343b5fe484549def25f38956e2` on GitHub `main`.
First public release-evidence commit: `36c9435e6983cdb6ef99fb815ea03bc91517dfb7`.

## Technical gates

- `npm run verify`: pass (ESLint, TypeScript, 15 Vitest files / 92 tests, production build).
- Catalog validation: pass (40 scored products, 10 complete-nutrition rows, 19,076 Barbora pages indexed).
- `npx playwright test --list`: pass, 21 Mobile Safari scenarios discovered.
- Full local WebKit execution: not run; the managed sandbox rejects `127.0.0.1:3000` with `listen EPERM`.
- Railway GitHub App is restricted to `seanastasiia/sugar-no-scanner-demo`; source branch is `main`; automatic deployments are enabled.
- Railway build `d74eb3d6-6f37-4f90-b7b8-4c42439a505b`: successful via GitHub.
- Production health after the first release-evidence commit: status `ok`, exact SHA `36c9435e6983cdb6ef99fb815ea03bc91517dfb7`.

## Production browser smoke

- Public `/`: opens directly into the live camera scanner; no access form or `Private demo` label.
- Initial state: `Waiting for camera permission…`, `Show demo` remains visible and raw-frame retention copy says frames are never stored.
- Shelf demo: 4 unique products, 4 rated products, one fair best, two Great fits, one Moderate fit and one Low fit; all overlays are aligned with the four packages.
- Collapsed results sheet: visible over the shelf and expands with `View all`.
- Expanded product page: full Protein/Fiber/Sugar values, similar options and exact Barbora action; collapse returns to the held camera scene.
- Checkout demo: one whole checkout-belt photo returns the same four unique rated SKUs through the same overlay and result-sheet interaction.
- Exact Barbora partial-data check: `barbora:zemesrieksti-estrella-ar-medu-140-g` returned `partial_overall`, `2/3`, Protein + Sugar only, with Fiber null and no invented value.
- Exact Barbora data-poor check: `barbora:gaz-dz-sanpellegrino-zero-peach-0-33-l-d` returned `identity_only`, zero signals and no overall fit.

## Real Latvian shelf benchmark

Seven public Latvian-store images were reviewed for framing. They are wide establishing shots, not close shopper-distance frames, so they are not valid evidence for the target CV thresholds. A repeat upload to the deployed scanner was not run because the controlled browser's file-upload permission was declined; no workaround was attempted. Real recall, false-positive rate, rated coverage, duplicate rate and p95 latency therefore remain unproven.

Next physical QA: capture 10–20 ground-truthed frames at roughly 0.5–1.5 m in a Latvian store, then report identity recall, exact/visual-only split, rating coverage, duplicates, unsupported false positives and latency separately.
