# Personal Shelf Rank local verification, 3 September 2026

Application/source commit: `38213f0216d333b848d332d20576f65a4e09ca1f`, branch `codex/multilingual-catalog-protein`. Builds on unpublished multilingual catalog `726e2cb`; pilot implementation `93e5875`, browser-fixture compatibility `806f87f`. No push, Railway deployment or Supabase migration/seed was performed. This note is documentation only.

## Final technical checks

| Check | Result |
| --- | --- |
| `npm run verify` on the exact source tree committed as `38213f0` | Pass: ESLint, TypeScript, 49 Vitest files / 300 tests, all three catalog validators, Next production build and standalone asset preparation |
| `CI=1 npm run test:e2e` on `38213f0` | Pass: 34/34 Mobile Safari scenarios, 1.3 minutes, no retries in final run |
| `npm run catalog:validate:shelf-pilot` | Pass: 198 distinct dated retailer observations, 64 scorable; 2 contradictory tables unscored |
| `npm run supabase:seed:shelf-pilot` | Pass dry-run: 198 retailer records, 0 OFF records, 64 scorable; no DB writes |
| `npm run catalog:sync:shelf-pilot` | Pass dry-run: bounded 100-page plan; no network calls or writes |
| Exact existing-ID refresh with `--apply --refresh-existing` | 198 fetched / 0 failed; only those existing pilot IDs refreshed |
| `git diff --check` | Pass |
| Production read-only `/api/health` | HTTP success, `status=ok`, commit `cc80a339fd5643aa3dbd80be808bbeecc24e6c83` at 09:51 UTC; not the new local pilot |

The dev server printed expected cancellation-path `ECONNRESET` messages during aborted camera/navigation tests; the final assertions passed. Playwright stopped its local server after completion. No live Gemini recognition benchmark, physical-store acceptance or actual Supabase migration execution is claimed.

## Data-quality finding and correction

Visual inspection of the real-card preview exposed Livinn `03000011074` with 57.8 g protein. Its exact source page was re-read: it really reports protein 57.8 g, carbs 47 g and fat 29 g per 100 g. No value was silently corrected. Extra exact macro fields now gate both original Fit and the independent pilot. `1AM180309678` is also outside the pilot's consistency allowance (known macros total 101.7 g); it is unscored pending source review, not labelled harmful.

The refresh added only fat/carbohydrate consistency fields and fresh timestamps, except `03000008260` gained the previously missing exact saturates value 5.1 g. Accordingly, chips changed from 16 to 15 scorable and cookies from 4 to 5; total coverage remained 64/198. Final groups: chips 15/40, crackers 9/40, yogurt 31/38, bars 4/40, cookies 5/40. Missing nutrients and unrecognized base/category evidence remain unscored.

Earlier development runs found test-harness defects (a strict selector matching several closed disclosures, React development Strict Mode starting/cancelling an extra effect, and Node requiring JSON import attributes outside Next). These were fixed in the tests; they did not justify changing legacy Fit semantics. The final run above supersedes those failed development runs. The subsequently found real source-data contradiction was a product defect and received its own trust guard plus regression tests.

## Visual and product checks

UI review used the existing design tokens, native disclosures, neutral preference-score styling, accessible touch targets, and an opt-in switch preserving original Fit. Claude reviewed only a non-sensitive UI brief; its output was reviewed locally, not applied blindly.

Inspected screenshots (ignored, not committed):

- `test-results/scanner-personal-shelf-pil-e85e1-ns-in-the-mobile-comparison-Mobile-Safari/personal-shelf-livinn.png`: real dated Livinn evidence, two scored chips plus the contradictory unscored SKU, loaded packshot, correct `/100` and category denominator. Recognition is mocked, not a real camera accuracy claim.
- `test-results/scanner-personal-shelf-pil-2cfd5-dark-mode-and-enlarged-text-Mobile-Safari/personal-shelf-dark.png`: dark 375 px mobile fixture. Automated checks also cover reduced motion, 200% text, landscape, no document overflow and axe WCAG A/AA.

Owner check before broad rollout: compare two same-type packages and their exact source numbers; inspect a high limiting-nutrient and an incomplete/contradictory card; switch the pilot off and confirm original behavior. The detailed checklist and openly provisional formula are in `docs/personal-shelf-rank.md`. Dairy-dessert calibration, broader ingredients coverage, physical-store usefulness and explicit `ПУБЛИКУЙ` remain open gates.
