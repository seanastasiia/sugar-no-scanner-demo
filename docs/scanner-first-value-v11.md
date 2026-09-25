# Shelf Scanner v11 activation test — 25 September 2026

Owner approved publishing the ranked v11 variant on 25 September 2026. Prepared on `codex/scanner-first-value-v11`, based on production/main `ab5d31f`; record deployment verification separately.

## What this tests

Show the benefit before a scenario choice: one photo, four real sample SKUs, their confirmed sugar/protein differences per 100 g, then one main action to compare the visitor's products. No claim that one nutrient alone makes a product healthier. No change to price, free allowance, recognition, product scoring or live advertising.

The comparison values come from the deterministic sample's catalog records, passed as four serializable rows from the server. The client does not import the full catalog. An unavailable nutrient renders `—`, never zero. Sample details remain accessible without camera permission.

## Proposed ad pair — drafts only

Match the candidate's ranked comparison: Salty Peanut first, ICONFIT Cookie Bliss second, Coco Choco third, Lemon Cheesecake fourth according to their existing Sugar + Protein Fit scores. Use catalog packshots and the same sugar/protein values and per-100-g unit. The first screen now uses the leader's catalog packshot rather than the shelf photograph; any future ad must match the final approved visual. Do not suggest the scanner reads nutrients directly from an unreadable shelf label. Do not promise every product will be recognized.

English primary text: **Photograph a shelf. Compare sugar and protein across the products we can identify. Try 3 successful scans free.**

English headline: **One shelf photo. Compare sugar and protein.**

Landing CTA: **Compare my products — free**.

Candidate destination after approval: the existing Scanner root with `utm_source=meta&utm_medium=paid_social&utm_campaign=shelf_lv_pilot_02&utm_content=compare_v11_en`. Do not send paid traffic to a local preview. Owner approved extending the existing campaign on 25 September: lifetime cap €150 (an additional €30), ending 28 September 2026 at 23:59 Europe/Riga. Keep the audience and three active creatives unchanged; Static B remains off. Verify the schedule and budget after applying them.

Latvian hypothesis, **not implemented or published**: “Nofotografē plauktu. Salīdzini cukura un olbaltumvielu daudzumu produktos.” CTA: “Salīdzināt manus produktus — bez maksas”. Validate with a native speaker before creating a matched Latvian ad/landing pair. Test language separately from the new English entry screen; don't send a Latvian promise to an English variant and call that a language test.

## Success measurement

Primary: completed real camera/upload scans per campaign tab visit; report actual-onboarding-to-real-result separately to distinguish activation from returning traffic. Never count sample-shelf/sample-conveyor as real scans. Compare equivalent complete Riga days and ad mix, with counts and uncertainty, not a claimed winner after a few visits.

Read-only SQL: `scripts/analytics/scanner-daily-funnel.sql`. Day defaults to yesterday in Europe/Riga; replace `report_day` with a date to reproduce a report. Denominator is unique tab visits with step-1 `onboarding_step_viewed`. Subsequent events must occur in order, and completion must link to a matching started scan ID/source. Independent real-start/result counts include returning visits and must not be described as this ordered funnel. Historical UTM can be inherited from localStorage; v11's entry campaign fixes future classification, without rewriting history. A new tab/direct return isn't cross-day retention. `qa=1` excludes an explicitly marked test visit but cannot identify old unmarked QA or all bots. Checkout event absence is not Stripe reconciliation.

## Incident investigation

September 24 Riga: Amplitude showed one unique real scan start and zero real completions. Source was filtered to camera/upload; aggregate data does not reveal the cause. Railway and production Supabase are now readable. Supabase confirms a campaign-labelled camera visit with permission granted and a scan start; a Railway response a few seconds later returned zero raw detections. This is temporal correlation, not a shared-ID join. No provider failure was logged for that response; image content and the reason for no detections remain unknown. The timeline query selects bounded event fields and anonymous scan/visit IDs, no photos or raw metadata. Do not infer server failure or voluntary abandonment from an absent completion alone. The confirmed browser class is coarse and does not establish whether this was an Instagram/Facebook embedded browser.

Code inspection confirmed an independent measurement gap: no-match responses displayed a recovery state without an outcome event. The candidate adds `scan_no_match`, never counted as success or a technical error. The internal request ID allows future camera responses to be correlated with Railway; multi-pass uploads retain only the first response ID.

## Owner product checks

1. Candidate preview: inspect places 1–4, the leading package/score, sugar/protein units and the dominant free-compare button. Places use the existing Sugar + Protein Fit, not Personal Shelf Rank; ties share a place. Check the full sample details and clean-link save flow.
2. After an approved HTTPS deployment, open `/?onboarding=1&qa=1` from **both Instagram and Facebook on a real phone**. Tap Compare → allow camera → point at a shelf → wait for recognition → open a result. Repeat using a saved JPEG. Record approximate Riga time, app/OS and outcome, without private images.
3. Also try a view with no visible packages: expect a retry prompt, `scan_no_match`, no `scan_completed` and no free-success allowance consumed. Deny camera, then try saved photo. If the in-app browser blocks camera, open the same page in Safari/Chrome and repeat. A Mobile Safari emulator does not validate these native embedded browsers.
4. Reopen the completed visit: onboarding should be skipped; forcing it displays the comparison again. Verify QA events remain labelled and no sample appears as a real scan.

## Release gate

The owner explicitly approved publication in the current conversation on 25 September: “Да, так супер, давай запаблишим и запустим в тесты, сравним, как такой вариант работает.” This authorizes this reviewed ranked v11 release. Future production releases still require explicit approval. Then merge/push main, deploy via Railway, wait for success, and compare `/api/health` commit with GitHub before production smoke. Do not call this candidate deployed or the incident resolved beforehand.


## Before/after comparison

This is a sequential before/after test, not a randomized A/B experiment. Keep creative/audience changes separate. Primary metric: unique campaign tab visits with a completed real camera/upload scan divided by campaign app-opening visits; also show mounted first-screen → camera choice → start → same-scan result. Report counts and denominators beside percentages. Never include sample results or explicit QA in success.

Use daily SQL with `onboarding_version='11'` for the new variant, `'10'` for the previous one. Treat launch day as partial and separate the two versions. v11 entry-campaign measurement is stricter than v10's persistent UTM, so comparison retains attribution uncertainty. No significant-lift claim from a few visits or a zero baseline; no evidence of success without real completions. Track `scan_preparation_failed`, `recognition_failed` and `scan_no_match` independently to distinguish failure modes. If paid traffic ends or budget is exhausted, report insufficient traffic; do not treat no traffic as poor conversion or increase spend without an agreed cap.


## Pre-release verification — 25 September 2026

- Runtime tested at `5cbfeb0cee5171c80ae05df8096e02464e6981cc` (tree `2e33881699f084a30778a62a7ec2bc446055bd37`): `npm run verify` passed, 104 Vitest files / 842 tests, TypeScript, catalog validation, production build and standalone preparation. No lint errors; one existing unnecessary-dependency warning for `shelfResearchEnabled`. Local log: `/tmp/scanner-v11-release-verify.log`.
- `CI=1 WTP_PAYWALL_ENABLED=true E2E_PORT=3101 npm run test:e2e -- --workers=1`: 72 passed, 12 feature-gated skipped. Local log: `/tmp/scanner-v11-release-e2e.log`.
- The subsequent changes are documentation plus optional read-only SQL version filtering and its fixture assertions. `npm test -- src/server/scanner-funnel-sql.test.ts` passed (1 test); `git diff --check` passed. Local log: `/tmp/scanner-v11-version-sql.log`.
- Production deployment and real-device embedded-browser validation are separate from these local checks. The dated shared release record must record the deployed GitHub main SHA, health response, production smoke, event verification and remaining limitations.
