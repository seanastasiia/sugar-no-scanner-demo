# Selling onboarding launch candidate

Date: 2026-09-09  
Candidate branch: `codex/selling-onboarding-preview`  
Implementation commit: `a277de1`
Target after owner approval: existing Railway `pilot` environment only

Owner-test staging was updated on 9 September with branch head `61d352e`. Railway deployment
`e4b64ac8-a70c-461a-bbf9-694b3b4a6b1f` reached `SUCCESS`; staging health reported that exact SHA
with the test paywall enabled. The public pilot remained `f4c185d` with the paywall disabled and
production remained `08a5338`.

## Release boundary

This candidate is the existing live-pilot application plus selling onboarding version `7`. It does
not include a merge from the newer production `main`, does not expose the separate Personal Shelf
Rank entry, and does not change recognition, the fixed sugar-plus-protein Sugar.no Fit, catalog data,
prices, feedback storage or the payment model.

The owner-test staging environment is the only environment changed by this iteration. Health checks showed:

- pilot URL: commit `f4c185d`, `wtpPaywall: false`;
- production URL: commit `08a5338`, production remains a separate release lane.

## Required pilot configuration before advertising

Keep every value in Railway, never GitHub:

- `WTP_PAYWALL_ENABLED=true`;
- live `STRIPE_SECRET_KEY`, the existing EUR 2.99 one-time `STRIPE_PRICE_ID`, and a dedicated signed
  `STRIPE_WEBHOOK_SECRET` for `/api/billing/webhook`;
- pilot Supabase URL and service-role key with both checked-in WTP billing migrations applied;
- pilot Amplitude key with `AMPLITUDE_ENVIRONMENT=pilot`;
- pilot Resend sending-only key, `FEEDBACK_EMAIL_ENABLED=true`, matching
  `FEEDBACK_EMAIL_ENVIRONMENT=pilot`, verified sender, and the approved owner recipient;
- `PERSONAL_SHELF_RANK_ENTRY_ENABLED=false` and `COMMIT_SHA` equal to the deployed GitHub commit.

Do not enable the paywall if any Stripe or Supabase value is missing. Do not reuse staging test-mode
Stripe keys or staging Amplitude/Supabase credentials.

## Deployment gate

Deploy only after an explicit owner command to publish the onboarding pilot. The release commit must
be pushed before the Railway deployment. Wait for Railway `SUCCESS`, then require `/api/health` to
return the exact release SHA and `wtpPaywall: true`. Production and staging must still return their
own unchanged SHAs.

## Live smoke before Meta traffic

1. Open a clean Safari session with the final Meta URL and bounded UTM parameters.
2. Confirm the first screen reveals no winner. Choose the at-home route, run the sample and see the exact BAREBELLS proof.
3. Confirm the in-store route reaches the transparent offer without requesting camera permission.
4. On the at-home offer, open `Save it for my next shop`, share or copy the clean link, and confirm no camera prompt. Reopen the link and confirm the onboarding starts normally.
5. Start the camera only from `Start my 3 free scans`; complete one rated scan and one unverified scan.
6. Confirm only the rated scan reduces the allowance and gallery upload uses the same allowance.
7. Reach the paywall after three rated scans and confirm EUR 2.99 once for seven days, no subscription.
8. With explicit owner approval, make one small real live-mode purchase, verify the success screen,
   entitlement, Stripe payment and webhook, then refund it from Stripe if desired.
9. Submit one labelled QA feedback and verify its Supabase row and owner email.
10. Verify Amplitude receives onboarding version `7`, `onboarding_path_selected`, optional
   sample/save/saved-link-return events, camera, scan, paywall, checkout and access events with environment
   `pilot`. Exclude the QA device/session from campaign analysis.

Do not start Meta spend until steps 1-10 pass on the deployed HTTPS URL.

## Rollback

The immediate pilot rollback is `f4c185d4fe9665f83ec1e1ce4acd70e2c669a47e`. Restore that commit
to the pilot service and return `WTP_PAYWALL_ENABLED=false`. Do not change production during a pilot
rollback. Verify the rollback SHA through `/api/health`.
