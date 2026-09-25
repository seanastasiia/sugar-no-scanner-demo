# Ranked onboarding preview, 25 September 2026

Unpublished code commit `f415fbce873ef500dcd67b0d3a5899226972a761`, source tree `2e33881699f084a30778a62a7ec2bc446055bd37`. Existing draft PR #1, production unchanged.

## Change

The owner requested visible first/second/third places and an updated main visual. The comparison now sorts by the existing Sugar + Protein Fit score, shows places 1–4, highlights the leader with its catalog packshot and score, and retains nutrient values per 100 g. Scores/formula are unchanged: Salty Peanut 91, ICONFIT 87, Coco Choco 64, Lemon Cheesecake 61. Ties share a place and unknown scores remain unranked. This is not the separate Personal Shelf ranking or a claim about overall health.

## Technical checks

- Related Vitest: 3 passed (order follows scores, ties/unknowns, missing catalog identity). Typecheck passed after accommodating nullable catalog images.
- Lint: zero errors; existing unrelated scanner hook dependency warning remains.
- Initial targeted UI/smoke run: 9 passed, 2 layout failures. Save action extended below the short portrait viewport. Compact leader layout fixed it.
- Final focused rerun: 2 passed, covering first-visit actions/accessibility and 7 viewport sizes including small portrait and landscape. No obscured actions or horizontal overflow. No screenshot-only mockup: the artifact is a rendered Mobile Safari screenshot of this code.
- `git diff --check` passed. Local/GitHub source trees matched before alignment.
- No recognition/scoring/price/ads/schema changes; no repeated full release suite for this presentation-only follow-up. Prior complete v11/no-match test evidence remains in adjacent test logs.

Full local logs: `/tmp/scanner-rank-unit.log`, `/tmp/scanner-rank-check.log` (initial type failure followed by lint), `/tmp/scanner-rank-typecheck.log` (corrected typecheck), `/tmp/scanner-rank-ui.log`, `/tmp/scanner-rank-ui-final.log`.

Final persistent preview: `/Users/anastasiia/.codex/artifacts/shelf-scanner/onboarding-ranked-2026-09-25.png`.

## Owner product check

Read the order at a glance without comparing each nutrient value; check that the leader image matches row 1, the ranking basis is understandable, and the free-compare button remains prominent. Physical phone camera validation is still pending from the incident investigation. Production publishing still requires explicit ПУБЛИКУЙ.
