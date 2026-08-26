<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Sugar.no scanner working rules

## Read first, and only what the task needs

- `README.md` is the current product and operations source of truth.
- `docs/architecture.md` is the code map. Start there before opening large source files.
- `Bugs.md` contains active limitations and only recent regressions.
- Do not load `data/*.generated.json`, screenshots, or `docs/test-runs/` into context by default. Query generated data with a narrow `jq`, `rg`, or purpose-built script.
- Git history is the archive. Do not restore superseded release logs or generated QA screenshots to the active tree.

## Change boundaries

- Preserve the trust rules: no invented nutrition, no non-exact retailer CTA, no image persistence, and price never affects Sugar.no fit.
- Keep deterministic Shelf and Checkout scenes in `src/server/demo-scenes.ts`; production recognition stays in `src/server/recognition.ts`.
- Keep client image preparation in `src/lib/client-image.ts`, result cards in `src/components/scanner-results.tsx`, and camera orchestration in `src/components/scanner-app.tsx`.
- Generated catalog files are changed only through scripts in `scripts/`.
- Browser screenshots belong in ignored `test-results/`, never in tracked documentation.

## Proportional checks

- Docs or copy only: `git diff --check` plus link/path checks.
- Local pure logic: related Vitest files, then `npm run check:fast`.
- UI: related Vitest files, `npm run check:fast`, and `npm run test:e2e:smoke`.
- Recognition, scoring, privacy, auth, schema, dependencies, or release: `npm run verify` and `CI=1 npm run test:e2e`.
- Before declaring code ready: update `README.md` and `Bugs.md`, push to GitHub `main`, deploy through Railway, and verify `/api/health` reports the pushed SHA.

# Sugar.no scanner workflow

Keep routine work small. Read only the files and sections needed for the requested change; use `rg` before opening large files. Do not reread the full README, Bugs history, test logs, or generated catalog unless the task directly needs them.

## Change lanes

- **Docs or copy only:** inspect the diff and links. No build, browser suite, Railway deployment, screenshot regeneration, or release log unless explicitly requested.
- **Small UI/style change:** run lint on touched files, typecheck, and `npm run test:e2e:smoke`. Deploy once after the final approved batch.
- **Local logic change:** run the related Vitest file(s), typecheck, then `npm run check:fast`. Add only the relevant browser scenario when user-visible.
- **Recognition, scoring, privacy, auth, dependencies, schema, or release-critical change:** run `npm run verify`, full `CI=1 npm run test:e2e`, push `main`, deploy once to Railway, and smoke production.

Plan both technical checks and a short owner product check before editing. Batch related edits into one commit and one deployment. Do not deploy intermediate states merely because a file changed.

## Context and evidence discipline

- README describes current setup and behavior, not release history.
- Bugs.md contains open issues and only the most recent resolved regressions. Git history is the archive.
- Create a dated test log only for release-critical work or when evidence is requested.
- Generate screenshots only when visual acceptance requires them. Preserve pre-existing dirty files.
- Do not browse the web, load broad shared context, or invoke subagents unless the task actually requires it.
