# Shelf Scanner v11 candidate — 25 September 2026

Unpublished branch `codex/scanner-first-value-v11`, based on production/main `ab5d31f`.

## What this tests

Show the benefit before a scenario choice: one photo, four real sample SKUs, their confirmed sugar/protein differences per 100 g, then one main action to compare the visitor's products. No claim that one nutrient alone makes a product healthier. No change to price, free allowance, recognition, product scoring or live advertising.

The comparison values come from the deterministic sample's catalog records, passed as four serializable rows from the server. The client does not import the full catalog. An unavailable nutrient renders `—`, never zero. Sample details remain accessible without camera permission.

## Proposed ad pair — drafts only

Use the existing `/samples/latvia-shelf.jpg` photo of the same four bars, in the same left-to-right order. Show the same sugar/protein values and the per-100-g unit. Do not suggest the scanner reads nutrients directly from an unreadable shelf label. Do not promise every product will be recognized.

English primary text: **Photograph a shelf. Compare sugar and protein across the products we can identify. Try 3 successful scans free.**

English headline: **One shelf photo. Compare sugar and protein.**

Landing CTA: **Compare my products — free**.

Candidate destination after approval: the existing Scanner root with `utm_source=meta&utm_medium=paid_social&utm_campaign=shelf_lv_pilot_02&utm_content=compare_v11_en`. Do not send paid traffic to a local preview. Keep existing campaign, budget and ads unchanged until a launch decision; Static B remains off.

Latvian hypothesis, **not implemented or published**: “Nofotografē plauktu. Salīdzini cukura un olbaltumvielu daudzumu produktos.” CTA: “Salīdzināt manus produktus — bez maksas”. Validate with a native speaker before creating a matched Latvian ad/landing pair. Test language separately from the new English entry screen; don't send a Latvian promise to an English variant and call that a language test.

## Success measurement

Primary: completed real camera/upload scans per campaign tab visit; report actual-onboarding-to-real-result separately to distinguish activation from returning traffic. Never count sample-shelf/sample-conveyor as real scans. Compare equivalent complete Riga days and ad mix, with counts and uncertainty, not a claimed winner after a few visits.

Read-only SQL: `scripts/analytics/scanner-daily-funnel.sql`. Day defaults to yesterday in Europe/Riga; replace `report_day` with a date to reproduce a report. Denominator is unique tab visits with step-1 `onboarding_step_viewed`. Subsequent events must occur in order, and completion must link to a matching started scan ID/source. Independent real-start/result counts include returning visits and must not be described as this ordered funnel. Historical UTM can be inherited from localStorage; v11's entry campaign fixes future classification, without rewriting history. A new tab/direct return isn't cross-day retention. `qa=1` excludes an explicitly marked test visit but cannot identify old unmarked QA or all bots. Checkout event absence is not Stripe reconciliation.

## Incident investigation

September 24 Riga: Amplitude showed one unique real scan start and zero real completions. Source was filtered to camera/upload; aggregate data does not reveal the cause. Supabase and Railway require restored login on this Mac. The timeline query selects bounded event fields and anonymous scan/visit IDs, no photos or raw metadata. Once accessible, correlate its timestamp with recognition HTTP outcome/server error; do not infer server failure from an absent completion alone.

## Owner product checks

1. Candidate preview: inspect 4 products, sugar/protein units and the dominant free-compare button. Check the full sample details and clean-link save flow.
2. After an approved HTTPS deployment, open `/?onboarding=1&qa=1` from **both Instagram and Facebook on a real phone**. Tap Compare → allow camera → point at a shelf → wait for recognition → open a result. Repeat using a saved JPEG. Record approximate Riga time, app/OS and outcome, without private images.
3. Deny camera, then try saved photo. If the in-app browser blocks camera, open the same page in Safari/Chrome and repeat. A Mobile Safari emulator does not validate these native embedded browsers.
4. Reopen the completed visit: onboarding should be skipped; forcing it displays the comparison again. Verify QA events remain labelled and no sample appears as a real scan.

## Release gate

Review candidate and test evidence first. Production requires the explicit `ПУБЛИКУЙ` approval specified in the shared workspace AGENTS.md. Then merge/push main, deploy via Railway, wait for success, and compare `/api/health` commit with GitHub before production smoke. Do not call this candidate deployed or the incident resolved beforehand.
