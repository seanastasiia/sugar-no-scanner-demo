# Week-one scanner lessons and guardrails

- Date: 2026-08-25
- Documentation commit tested: `19802cf`
- Scope: team-facing engineering and product guardrails distilled from the first week of scanner development

## Technical checks

- `git diff --check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 22 files, 121 tests passed.
- `npm run build`: Next.js production build and standalone asset preparation passed.
- `CI=1 npm run test:e2e`: 24 Mobile Safari scenarios passed.

The browser suite covered the deterministic Shelf and Checkout scenes, source-switch cancellation, iPhone 17 Pro and adjacent viewport sizes, uploaded-image tiling, multi-product recognition, held results, progressive enrichment, rate limiting, provider failure, privacy and WCAG A/AA checks.

## Documentation verification

- The new guide separates visible identity, exact SKU, verified nutrition, Sugar.no fit and current retailer offer.
- It records 42 confirmed lessons with the failure, mandatory guardrail and required regression for each.
- It includes a change-area test matrix and eight product acceptance checks.
- It is linked from both the README evidence section and the team handoff start-here sequence.
- Chronological defect detail remains in `Bugs.md`; the new guide does not replace that log.

## Product acceptance check

1. Open `docs/week-one-lessons.md` and confirm a new engineer can explain the five separate evidence states without reading implementation code.
2. Pick one planned scanner change and use the change-area table to identify its required tests.
3. Confirm the ten non-negotiable product rules match the intended investor-demo behavior.
4. Use the eight product checks as the release review for the next recognition or camera change.

## Release requirement

The documentation is considered published only after GitHub `main` contains this evidence and Railway reports `SUCCESS` with the matching release commit through `/api/health`.
