# Personal Shelf score-row spacing production release

Date: 2026-09-09  
Environment: Railway production  
Application commit: `1ba7d0e4b8d197718fdc29f15b2d87eb06bedca0`

## Change

- Balanced the closed `Why this score` row so the label has the same visual space above and below it.
- Kept the disclosure target at 44 px and left the expanded point grid unchanged.
- The fix applies to both deterministic demo and real recognition results through their shared renderer.

## Technical verification

- `npm run verify`: passed.
  - ESLint and TypeScript passed.
  - 77 Vitest files / 701 tests passed.
  - Catalog validators passed with 7,512 Personal Shelf observations: 2,334 complete, 3,426 provisional and 1,752 unscored.
  - Production build passed.
- `CI=1 E2E_PORT=3012 npm run test:e2e`: all 61 Mobile Safari scenarios passed.
- The targeted Personal Shelf demo suite passed all four scenarios and now asserts that the closed row's upper and lower visual spacing differ by no more than 2 px.
- `git diff --check`: passed before commit.

## Deployment

- GitHub `main` deployment `12589c7d-aa1a-439c-894d-6d8ab7704138`: `SUCCESS` for the exact application commit.
- Explicit Railway CLI deployment `40079bbc-65df-4ed4-a863-cb7e70eeed16`: `SUCCESS`.
- Live `/api/health` returned `ok` and exact commit `1ba7d0e4b8d197718fdc29f15b2d87eb06bedca0`.
- Live WebKit smoke on `/demo/personal-shelf` returned HTTP 200 and confirmed:
  - three rated cards;
  - 15.203125 px above and below the first collapsed label;
  - 44 px disclosure target;
  - no horizontal overflow;
  - no demo API calls.

## Rollback

- `production-before-personal-score-spacing-2026-09-09` points to the previous production commit `032ae0c12e232ddac9dd92ae18f58d37cd2654c8`.

## Product check

1. Open `/demo/personal-shelf` on iPhone Safari.
2. Confirm the collapsed `Why this score` label sits visually midway between the divider and the bottom of the card.
3. Tap it and confirm the four criterion point cells still open normally.
4. Repeat on a real Personal Shelf result; both screens use the same component.
