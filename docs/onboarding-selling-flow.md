# Shelf Scanner selling onboarding — research and experiment

Date: 2026-09-18
Branch: `codex/onboarding-v9-sample-first`
Base: production onboarding version 8

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
| Problem and solution first | “Find the better fit in one shelf photo” plus the top real sample result | Completes the ad-to-product promise immediately |
| User convinces themselves | The shopper chooses a real scan, an immediate sample, or saves the link for the next shop | Uses current context rather than a cosmetic survey answer |
| Reflect the answer | Not included in v1 | Honest omission: the scanner does not change its fixed two-factor ranking from a preference answer |
| Try the core feature | Tap `See all 4 sample results` to open the complete deterministic four-product result immediately | Creates the aha moment without camera permission or an intermediate reveal screen |
| Summarize the bridge | The preview shows four detected products and both useful actions lead directly to a result | Connects the ad promise to the product without a generic congratulations screen |
| Be clear that it is paid | The entry screen states 3 free successful scans, then €2.99 once for 7 days | Avoids surprise and matches the current experiment |
| Use social proof | Not included yet | No verified Shelf Scanner testimonial or review count exists |
| Review at emotional peak | Defer to existing feedback after the first successful real result | Web feedback is more useful than an App Store prompt here |
| Trial reminder | Not applicable | The offer is a one-time seven-day entitlement, not auto-renewing |

## Context-aware screen flow

1. **One-screen promise and proof.** Shelf Scanner compares confirmed sugar and protein data with no account. The same screen shows the real shelf, the top sample product with both confirmed values, the three-free-scan allowance, the one-time €2.99 price and all three actions.
2. **At-home sample route.** `See all 4 sample results` is the single coral primary action. It records `at_home`, records the sample reveal and opens the complete deterministic four-product result immediately without camera permission.
3. **In-store route.** `Scan my shelf now` records `in_store`, completes onboarding and opens the camera immediately. This secondary action is the first camera-permission boundary.
4. **Save for later.** `Save for my next shop` opens a modal that uses the browser's share sheet to send a clean `?saved=1` link to Messages, WhatsApp or Notes. If sharing is unavailable, it copies the link and exposes a selectable manual fallback. It also explains that one-tap access can be added after opening the saved link in Safari or Chrome and choosing `Add to Home Screen`. It does not request camera, email, notification or account access. Opening the saved link records a bounded anonymous return event.

The page does not claim that it can install itself directly. Meta in-app browsers commonly do not expose an install prompt, so the primary action remains share-to-self; the home-screen instruction applies after the clean link is opened in Safari or Chrome. iOS Home Screen web apps can have separate local storage, so paid users may need the existing access restore path after switching contexts.

## Measurement plan

Treat the reported PrayerLock numbers as inspiration, not a forecast. Onboarding version 9 keeps the one-screen structure from version 8, but shows a concrete ranked result before interaction and gives the sample one clear primary position. Compare it with version 8 using comparable English-language Meta traffic and first-party anonymous events.

Primary funnel:

1. `app_opened`
2. `onboarding_started`
3. `onboarding_path_selected` (`at_home` or `in_store`) and optional `onboarding_sample_revealed`; `onboarding_step_viewed` remains step 1 only in version 9
4. optional `onboarding_save_prompt_viewed` and `onboarding_save_action` (`shared`, `copied`, `dismissed` or `failed`)
5. optional `onboarding_saved_link_opened` on a later visit
6. `onboarding_completed`
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
