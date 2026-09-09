# Personal Shelf method-heading production release

Date: 2026-09-09  
Environment: Railway production  
Application commit: `d5eff3fd49cabef200682c33513d0b7683ef1744`

## Change

- Replaced the expanded `How scores work` introduction's repeated Sparkles icon and blue tinted card with a plain semantic heading and short supporting copy.
- Kept the outer disclosure's blue icon and its 44 px minimum touch target.
- Kept the four soft-color Sugar, Protein, Ingredients and Balance signal cards below the introduction.
- Applied the same shared renderer to the fixed demo and real recognition results. Scoring, evidence, scores and ranks are unchanged.

## Technical verification

- `npm run verify`: passed.
  - ESLint and TypeScript passed.
  - 77 Vitest files / 701 tests passed.
  - Catalog validators passed with 7,512 Personal Shelf observations: 2,334 complete, 3,426 provisional and 1,752 unscored.
  - Production build passed.
- `CI=1 E2E_PORT=3012 npm run test:e2e`: all 61 Mobile Safari scenarios passed.
- The focused four-scenario Personal Shelf demo suite passed before the full run and checks the semantic heading and absence of an intro icon.
- The ordinary Shelf demo regression now scopes its count to the four product headings, so the new method heading cannot be mistaken for a product.
- `git diff --check`, ESLint and TypeScript passed after the final test adjustment.

## Deployment

- GitHub `main` deployment `9467e1b0-9ae5-4419-a9fb-ccf1866a8f5e`: `SUCCESS` for the exact application commit.
- Explicit Railway CLI deployment `9dedb1c0-895e-4cb6-b08d-2b524d6fcb5e`: `SUCCESS`.
- Live `/api/health` returned `ok`, exact commit `d5eff3fd49cabef200682c33513d0b7683ef1744` and the expected catalog counts.
- Live WebKit smoke on `/demo/personal-shelf` returned HTTP 200 and confirmed:
  - three rated cards and four scoring-signal cards;
  - a level-two `Up to 100 points, shaped around your priorities.` heading;
  - no SVG or tinted background inside the introduction;
  - both outer disclosure icons remain and its summary is 64 px high;
  - no horizontal overflow and no demo API calls.
- Live screenshot: `/tmp/personal-method-heading-production.png`.

## Rollback

- `production-before-personal-method-heading-2026-09-09` points to the previous production commit `5f46e8b8e52220cd970836d86a567a8f5aa8d44f`.

## Product check

1. Open `/demo/personal-shelf` on iPhone Safari and expand `How scores work`.
2. Confirm the introduction reads as one calm heading without its own icon or colored card, while the four criteria remain visibly color coded.
3. Collapse the section and confirm the outer blue icon and arrow remain easy to tap.
4. Repeat in a real Personal Shelf result; both screens use the same component.
