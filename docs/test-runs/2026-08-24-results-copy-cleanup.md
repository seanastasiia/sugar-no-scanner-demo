# Expanded results copy cleanup release evidence

Date: 2026-08-24

## Source state

- Code commit: `25e13f9ca55d39f04d92e3b50be78bfe95cd2f91`
- GitHub branch: `main`
- Production: <https://sugar-no-scanner-demo-production.up.railway.app>

## Technical checks

- `npm run verify`: passed.
  - ESLint passed.
  - TypeScript passed.
  - Vitest passed: 16 files, 80 tests.
  - Next.js production build passed.
- GitHub Actions `Latvia public shelf benchmark` run 11: passed on the code commit.
  - <https://github.com/seanastasiia/sugar-no-scanner-demo/actions/runs/32767152289>
- Railway health check returned `status: ok` and the code commit before the production smoke.
- Production Shelf demo smoke:
  - zero `Shelf marker legend` blocks;
  - zero marker-scope explanation paragraphs;
  - one Sugar.no badge remains;
  - Protein and Sugar remain visible in that badge.

## Product check

1. Open production and choose `Show demo`, then `Shelf demo`.
2. Tap `View all`.
3. Confirm there is no separate Great/Moderate/Low legend or marker explanation below `Scan again`.
4. Confirm each product still carries its own fit and the selected card still shows Protein and Sugar.
5. Open a one-signal fixture in QA and confirm the badge is present without a second limited-signal explanation card.

