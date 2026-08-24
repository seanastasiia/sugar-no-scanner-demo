# Recognition benchmark harness — 2026-08-24

## Scope

- Add a direct local-image path to `/api/recognize` without browser file upload.
- Preserve the existing transient-frame and `imageStored: false` privacy contract.
- Produce metadata-only evidence for unique identities, rated coverage, exact-ID recall, duplicates and latency.
- Do not contact production or copy/store source image bytes during implementation verification.

## Verification

Executed in the shared working tree based on local commit `ca1571977eaa73dc97badbda4660f487f180cacf`:

```bash
npm test -- src/lib/recognition-benchmark.test.ts src/app/api/recognize/route.test.ts src/server/event-privacy.test.ts
npm run typecheck
npm run lint
npm run benchmark:recognition -- --help
git diff --check
```

Results:

- targeted Vitest: 3 files, 14 tests passed;
- full `npm run verify`: ESLint passed, TypeScript passed, 16 Vitest files / 95 tests passed, Next.js production build passed and standalone assets were prepared;
- CLI help/smoke: passed;
- diff whitespace check: passed;
- a local unreachable-endpoint smoke read a 367,376-byte, 1200 × 903 JPEG into memory, produced a create-only metadata report with case ID `case-01`, returned the safe error `fetch failed` and did not include the source filename/path;
- no production endpoint was contacted and no source image bytes were written by the harness.

The managed QA sandbox cannot bind a local Next.js port and has no shell DNS access to Railway, so a real Gemini request is intentionally left for CI or a normal local shell. The harness itself is covered without sending an image externally; the existing route-level test also verifies the public no-storage response contract.

## Product check

1. Manually label the visible SKU IDs in 10–20 Latvian shelf frames captured from 0.5–1.5 m.
2. Run the manifest form of `benchmark:recognition` against a normal local server or the deployed endpoint.
3. Confirm the report has no image paths/raw OCR and `privacy.imageStorageContractPassed` is `true`.
4. Review identity recall, rated coverage, duplicates and latency separately; do not treat a visually named but unrated package as a rated success.
