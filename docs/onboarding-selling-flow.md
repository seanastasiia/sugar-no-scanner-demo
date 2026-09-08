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

The PrayerLock flow is a 10–15 minute native-app journey with a free trial. Shelf Scanner is a mobile-web utility opened from a Meta ad, often while the shopper is standing in a store. Copying 30 screens would delay the first useful result and camera permission. The experiment therefore keeps the psychology but compresses it into four steps designed to take less than one minute.

| Source principle | Shelf Scanner implementation | Why |
| --- | --- | --- |
| Problem and solution first | “A faster way to choose from the shelf” plus a real shelf comparison | Makes the ad-to-product promise explicit |
| User convinces themselves | One question: label reading, language or comparing products | Captures the concrete shopping friction without a survey |
| Reflect the answer | Step 3 and the final summary change copy from the selected friction | Adds relevance without pretending the nutrition data is personalized |
| Try the core feature | Tap `Scan this shelf` to reveal product boxes and the best fit | Creates the aha moment before camera permission |
| Summarize the bridge | “Your shelf shortcut is ready” plus the reflected problem | Repeats the value at the purchase decision point |
| Be clear that it is paid | Final card explains 3 free successful scans, then €2.99 for 7 days | Avoids surprise and matches the current experiment |
| Use social proof | Not included yet | No verified Shelf Scanner testimonial or review count exists |
| Review at emotional peak | Defer to existing feedback after the first successful real result | Web feedback is more useful than an App Store prompt here |
| Trial reminder | Not applicable | The offer is a one-time seven-day entitlement, not auto-renewing |

## Screen flow

1. **Promise.** Shelf Scanner compares confirmed sugar and protein data and shows the best fit first. Primary action continues; secondary action opens the deterministic sample without camera access.
2. **Self-identification.** The shopper selects the one shelf problem that feels most familiar. Continue stays disabled until a choice is made.
3. **Aha moment.** The selected problem is reflected back. A deliberate tap animates a scan and reveals the result; the next action appears only after the reveal.
4. **Offer and trust.** The selected problem is reflected again, the allowance and price are stated, and trust details explain that only successful results count, the payment is one-time and photos are not saved. The final tap opens the camera.

## Measurement plan

Treat the reported PrayerLock numbers as inspiration, not a forecast. Compare onboarding version 5 against the current flow using Meta traffic with the same targeting and creative mix.

Primary funnel:

1. `app_opened`
2. `onboarding_started`
3. `onboarding_step_viewed` steps 2, 3 and 4
4. `onboarding_completed` or `onboarding_skipped`
5. camera permission granted
6. first successful `scan_completed`
7. paywall viewed
8. checkout started
9. entitlement activated

Guardrails:

- time from open to first successful scan;
- onboarding skip rate;
- camera denial rate;
- scan success rate, separated from onboarding conversion;
- feedback reasons and support complaints;
- paid activation per ad click and acquisition cost.

Do not call a winner on a handful of purchases. First verify event integrity, then run both variants on comparable traffic and make the decision from paid activation per visitor, with scan-success and time-to-value as guardrails.
