# Dense Personal Shelf candidate preservation — 11 September 2026

Base: `486141ce2e167b864b05f4b0b55229879703ca12`. The commit containing this report preserves up to 40 candidates from the existing four bounded image passes in the internal pilot. Public recognition remains capped at ten; confidence rules, scoring and server quotas are unchanged. This is progress toward full-store coverage, not proof of that objective.

Technical evidence:
- `npm run verify` on final application changes: PASS, 96 files / 802 tests, catalogue validators and production build.
- Unit regression: 34 distinct candidates plus a duplicate produce 34 pilot results; the default public merge remains ten.
- Full Mobile Safari suite: 74 passed, one passed on retry, four skipped. The retry was the pre-existing broad-camera multi-product assertion; its standalone rerun is recorded below.
- New mobile 24-product scenario: four passes survive merge/application/enrichment and all 24 identities are delivered in batches of at most ten.
- Quota follow-up: pending identities remain in local storage while saved server results load; a waiting count is visible. Final related browser checks below.

Logs: `.catalog-sync/store-coverage/verify-final.log`, `e2e.log`, `e2e-final.log`. Interrupted redundant check runs are not counted as passes. Source photo diagnostic metadata remains in `sauce-baseline.json`: 34 candidates before global truncation, mostly visual-only; it does not establish recognition accuracy. No source image copies committed or persisted.

Owner check: open `/pilot/shelf`, upload a dense shelf, then inspect My products. Distinct candidates beyond the tenth should continue to be saved in batches. Repeated packs should not create extra SKU entries. At a daily limit, waiting items remain in this browser and already-saved results stay visible.

Remaining objective gaps: per-pass reading/label visibility, exact variant matching, repeat-scan verified-catalogue reuse, missing label data and comprehensive labelled shelf tests for Lidl, Rimi and Stockmann. The per-upload pilot ceiling is 40 and the server still permits 30 new owner receipts per day; this release is not an all-products guarantee or unrestricted store-session scan.

The related follow-up exposed an actual form-state race: an initial queue response could close the native details form during entry. The form now has explicit React state, and the offline test deliberately releases the initial response after opening it. This failure was fixed before publication. The first quota follow-up passed five scenarios and failed that form race; only the subsequent final run counts as release acceptance.

Final acceptance: 6 related Mobile Safari tests passed without retries (35.0 s), including the earlier broad-camera case, deterministic form refresh, 24-product delivery and quota persistence. Final typecheck passed; final verify passed 802 tests and build. GitHub/release revision is the commit containing this report.
