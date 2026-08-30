# Production cleanup and golden-release verification — 2026-08-30

## Scope

Preserve the approved scanner behavior and visuals at golden commit `3c83a65` while removing dead access-screen code and making release verification cover every generated catalog. No camera, recognition, scoring, ranking, pricing or result-screen behavior changed.

## Checks completed before release

- Clean isolated worktree created from `origin/main` at `3c83a65`; the older dirty local checkout was left untouched.
- `npm ci`: passed; 500 packages installed, 0 audit vulnerabilities.
- `npm run check:fast`: passed; lint, typecheck and 222 tests across 43 files.
- `npm run verify:catalog`: passed.
  - Curated catalog: 40 complete products, 10 with verified fiber.
  - Barbora index: 18,554 identities.
  - Operational Barbora coverage: 9,707 active products, exactly 7,433 auto-fit SKUs, no invalid or duplicate rows.
  - Rimi: 6,822 complete rows from the approved seven-category scope.
  - Livin: 6 complete rows.
  - Open Food Facts: 500 isolated ODbL rows.
- Hosted Supabase read-only verification: 4 catalog sources; 14,261 retailer products and immutable versions; exactly 7,433 Barbora, 6,822 Rimi and 6 Livin rows; 500 Open Food Facts rows; 99 nutrition cache rows and 27 immutable cache versions; all six permanent-cache freshness columns exist.
- `git diff --check`: passed.

## Final release evidence

- `npm run check:fast`: passed again; lint, typecheck and 222/222 tests.
- `npm run verify`: passed; lint, typecheck, 222/222 tests, both catalog validators and the production Next.js build.
- `CI=1 npm run test:e2e`: passed; 28/28 Mobile Safari scenarios in 59.3 seconds, including iPhone 17 Pro layouts, camera permission failure, full-frame and sectioned uploads, multi-product recognition, background enrichment, captured-frame stability, `Scan again`, no-image persistence and automated WCAG A/AA checks.
- Secret scan: no production credential was found. The one pattern match is an intentional fake Gemini key inside `src/server/recognition.test.ts`; `.env.example` is the only tracked env file.
- Repository-artifact scan: no tracked `.next`, `node_modules`, Playwright output, test result or log artifact.
- `git diff --check`: passed.
- Local standalone production smoke with a temporary demo session: `/api/health` 200 with 7,433 auto-fit products; `/` 200; bare recognition API 401; authenticated deterministic shelf recognition 200 with 4 detections and `imageStored: false`; analytics payload containing an image field rejected with 400.

GitHub push, Railway deployment and production health evidence are recorded in the release handoff after deployment.
