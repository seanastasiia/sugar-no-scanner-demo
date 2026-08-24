# Single collapse arrow release evidence

Date: 2026-08-24

## Source state

- Code commit: `15a278053a2eff9a4dfdcfb48bb41f9df20cce45`
- GitHub branch: `main`
- Production: <https://sugar-no-scanner-demo-production.up.railway.app>

## Technical checks

- `npm run verify`: passed.
  - ESLint passed.
  - TypeScript passed.
  - Vitest passed: 16 files, 80 tests.
  - Next.js production build passed.
- GitHub Actions `Latvia public shelf benchmark` run 10: passed on the code commit.
  - <https://github.com/seanastasiia/sugar-no-scanner-demo/actions/runs/32765059238>
- Railway health check returned `status: ok` and the code commit before the production smoke.
- Production Shelf demo smoke:
  - one `Collapse product results` control;
  - one upward chevron in the expanded dialog;
  - zero downward chevrons in the expanded dialog;
  - the text title remains a separate accessible `Return to camera` target.

## Product check

1. Open production and choose `Show demo`, then `Shelf demo`.
2. Tap `View all`.
3. Confirm the expanded header shows one arrow only, on the right.
4. Tap the title or the right arrow and confirm the held camera result returns.

