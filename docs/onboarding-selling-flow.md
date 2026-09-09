# Shelf Scanner selling onboarding — research and experiment

Date: 2026-09-08
Branch: `codex/selling-onboarding-preview`
Base: live-pilot commit `f4c185d`

## What the source material actually says

This is a detailed paraphrase and product analysis, not a verbatim transcript.

The Starter Story Build interview presents onboarding as a sales story with three acts:

1. **Introduction.** State the problem and solution immediately, create a personal realization in under a minute, ask questions that help the user articulate the need, and reflect those answers back. The featured PrayerLock founder attributes a rise from about 3% to 15% trial conversion to a much longer onboarding and loss aversion. This is one founder's result, not controlled evidence that length itself caused the lift.
2. **Climax.** Let the user try the core feature inside onboarding. Ask for a review at the emotional high point, after the user has received value and seen a streak. The App Store review tactic is relevant to a native app, not directly to the current web scanner.
3. **Conclusion.** Summarize the user's starting point, desired outcome and the product's bridge between them. Explain paid access before a free trial, frame price against a familiar purchase, ask for commitment, then use genuine social proof immediately before the paywall. Remind trial users before renewal.

The linked HubSpot guide landing page describes the same story arc, question bank and conversion sequence. It says the featured onboarding grew from 5 to 30 screens and reports 3% to 12–15% conversion. The full download is gated by a required form and permits HubSpot marketing contact, so it was not submitted without the owner's explicit choice of contact details.

Sources:

- [Starter Story Build video](https://www.youtube.com/watch?v=Di973jC2Jio)
- [Searchable episode transcript and outline](https://businessmaxxing.com/episode/ep_ytDi973jC2Jio)
- [HubSpot Mobile App Onboarding Deep Dive](https://offers.hubspot.com/mobile-app-onboarding)

## Adaptation for Sugar.no

The PrayerLock flow is a 10–15 minute native-app journey with a free trial. Shelf Scanner is a mobile-web utility opened from a Meta ad. Some visitors are already in a store, while others see the ad at home inside Instagram or Facebook. Copying 30 screens would delay the first useful result and camera permission. The experiment therefore keeps the useful psychology but branches by context. A Claude growth-design review challenged the original question because its answer did not change the ranking. We removed that decorative personalization instead of pretending it configured the product.

| Source principle | Shelf Scanner implementation | Why |
| --- | --- | --- |
| Problem and solution first | “Compare the shelf, not the labels” plus an annotated real shelf | Completes the ad-to-product promise immediately |
| User convinces themselves | The shopper chooses whether a shelf is in front of them or they need a sample | Uses current context rather than a cosmetic survey answer |
| Reflect the answer | Not included in v1 | Honest omission: the scanner does not change its fixed two-factor ranking from a preference answer |
| Try the core feature | Tap `Scan this shelf` to reveal a real product name and confirmed sugar/protein values | Creates the aha moment before camera permission |
| Summarize the bridge | The result names the evidence and the offer states exactly what counts | Connects the demo to the paid product without a generic congratulations screen |
| Be clear that it is paid | Final card explains 3 free successful scans, then €2.99 for 7 days | Avoids surprise and matches the current experiment |
| Use social proof | Not included yet | No verified Shelf Scanner testimonial or review count exists |
| Review at emotional peak | Defer to existing feedback after the first successful real result | Web feedback is more useful than an App Store prompt here |
| Trial reminder | Not applicable | The offer is a one-time seven-day entitlement, not auto-renewing |

## Context-aware screen flow

1. **Promise and context choice.** Shelf Scanner compares confirmed sugar and protein data with no account. `Scan the shelf in front of me` identifies an in-store visitor. `Not shopping yet — show me a sample` identifies an at-home visitor.
2. **In-store route.** The shopper reaches the transparent offer immediately, then opens the camera. There is no save prompt and no extra teaching screen.
3. **At-home route.** A deliberate sample tap reveals the actual winner with 2.3 g sugar and 36 g protein per 100 g. The offer also explains that a photo of anything in the cupboard can be uploaded now. The shopper can start the real scanner or use `Save it for my next shop`.
4. **Save for later.** A modal uses the browser's share sheet to send a clean `?saved=1` link to Messages, WhatsApp or Notes. If sharing is unavailable, it copies the link and exposes a selectable manual fallback. It does not request camera, email, notification or account access. Opening the saved link records a bounded anonymous return event.

`Add to Home Screen` is deliberately not promoted in this version. Meta in-app browsers commonly do not expose the install prompt, and iOS Home Screen web apps do not copy Safari local storage. The current free-scan allowance lives in local storage, so installation could create a second allowance and require paid users to restore access. Share-to-self tests delayed intent without introducing that state-integrity problem.

## Measurement plan

Treat the reported PrayerLock numbers as inspiration, not a forecast. Compare onboarding version 7 against the current flow using Meta traffic with the same targeting and creative mix.

Primary funnel:

1. `app_opened`
2. `onboarding_started`
3. `onboarding_path_selected` (`at_home` or `in_store`), optional `onboarding_sample_revealed`, and `onboarding_step_viewed`
4. optional `onboarding_save_prompt_viewed` and `onboarding_save_action` (`shared`, `copied`, `dismissed` or `failed`)
5. optional `onboarding_saved_link_opened` on a later visit
6. `onboarding_completed` or `onboarding_skipped`
7. camera permission granted
8. first successful `scan_completed`
9. paywall viewed
10. checkout started
11. entitlement activated

Guardrails:

- time from open to first successful scan;
- onboarding skip rate;
- save-prompt-to-share rate and saved-link return rate;
- delayed return to first successful scan;
- camera denial rate;
- scan success rate, separated from onboarding conversion;
- feedback reasons and support complaints;
- paid activation per ad click and acquisition cost.

Do not call a winner on a handful of purchases. First verify event integrity, then run both variants on comparable traffic and make the decision from paid activation per visitor, with scan-success and time-to-value as guardrails. Claude suggested roughly 250 purchases per arm before a confident winner; that is a statistical planning target, not a prerequisite for learning from directional pilot data.
