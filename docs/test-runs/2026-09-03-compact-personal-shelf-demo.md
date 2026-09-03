# Compact Personal Shelf Rank demo, 3 September 2026

Application commit: `5f7198e728499c4fccbe3cbef7f5f3cbc75f7e5e`, branch `codex/personal-rank-preview`.

## Scope

Demo-only compact Shelf-photo-style cards, category radio selector, whole-card evidence disclosure. Removed the intro, long category/count explanations, Consider text, separate Why this score buttons and footer. No changes to model, catalog, normal scanner, authentication, database or production/staging configuration. UI/UX checks and a minimal non-sensitive Claude review informed the 44 px category controls, native keyboard selection and accessible whole-card disclosure; long exact product variants remain readable rather than being truncated away.

## Technical results

- Touched-file ESLint and `npm run typecheck`: passed.
- Related Vitest files (`personal-shelf-demo`, `personal-shelf-rank`): 2 files, 34 tests passed.
- Targeted Mobile Safari demo suite: 4/4 passed.
- `npm run verify` on application commit: passed lint, typecheck, all 50 files / 302 tests, catalog checks and production build. Log: `/tmp/sugar-compact-demo-5f7198e-verify.log`.
- `CI=1 npm run test:e2e`: all 38 Mobile Safari scenarios passed, no retries needed. Log: `/tmp/sugar-compact-demo-5f7198e-e2e-standard.log`.
- Additional `E2E_PRODUCTION=1` diagnostic was stopped after protected legacy demo APIs returned 401 over local HTTP. Trace showed successful `/api/auth` but no session cookie on protected requests. Existing production Secure cookies require HTTPS in Safari. No security setting was changed. This harness limitation is recorded in README and Bugs; it is not reported as a passed full production-mode suite. Diagnostic log: `/tmp/sugar-compact-demo-5f7198e-e2e.log`.
- Non-blocking dev-server cancellation/ECONNRESET warnings occurred when pages exited in-flight requests. The standard suite still completed 38/38.

The four demo scenarios verify exact scores (64/61/unscored and 97/54), separate ranks, per-100-g protein/sugar, no invented nutrition for the inconsistent chip, removal of verbose UI, no camera or data API calls on direct entry/reload, keyboard category selection, collapsed/expanded card state, exact source links, broken packshots, 320/375 px, dark mode, 200% text, landscape, automated WCAG A/AA checks and return to the unchanged scanner. All three collapsed chips fit in the initial mobile viewport.

Visually inspected ignored screenshots in `test-results/`:

- `personal-shelf-demo-rating-61e62-d-exact-packshots-on-mobile-Mobile-Safari/compact-demo-chips.png`
- `personal-shelf-demo-rating-61e62-d-exact-packshots-on-mobile-Mobile-Safari/compact-demo-yogurts.png`
- `personal-shelf-demo-rating-c3f10-ssible-on-small-dark-phones-Mobile-Safari/rating-demo-dark-large-text.png`

## Deployment and live smoke

Pushed the clean application commit to GitHub before direct Railway upload. Explicit preview project `9e2a4887-0e19-4ca7-ae99-d68816542558`, environment `personal-rank-preview`, service `37730464-07ba-482d-9c59-74c04ecdf6db`. Deployment `c5584029-60b6-492e-84f1-ae5940c7dbb0` reached **SUCCESS**. Live `/api/health` returned `status: ok` and the exact application SHA at 11:18:21 UTC.

Live Browser verified the compact Chips screen, Yogurts switch and 97/54 values, whole-card expansion, original Latvian ingredients and the exact Barbora source. HTTPS root/session smoke returned HTTP 200; the existing `sample-shelf` API returned `matched`, four products and `deterministic-sample-v1`. The same API without a session returned 401 as intended.

Production remained healthy at `cc80a339fd5643aa3dbd80be808bbeecc24e6c83`; the independently managed staging remained healthy at `08da32a18e65422041446b182732878b42499f2c`, verified again at 11:18:48 UTC. No main push, production/staging deployment or database writes. Follow-up documentation-only commits do not redeploy this preview.

## Owner acceptance

1. Open [the same preview demo](https://sugar-no-personal-rank-personal-rank-preview.up.railway.app/demo/personal-shelf). Confirm the compact cards are easy to scan without the previous prose.
2. Switch Chips / Yogurts. Protein, sugar and category-local ranks should be immediately readable.
3. Tap a card to open and close its ingredients/source/points. The third chip stays unscored.
4. Use the top-right chevron to return to the scanner.

Physical-phone visual preference and real-store recognition remain owner checks; neither changes the existing scoring or production approval boundary.
