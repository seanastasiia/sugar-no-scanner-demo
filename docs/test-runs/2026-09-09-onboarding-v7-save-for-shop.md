# Selling onboarding v7 verification

Date: 2026-09-09
Branch: `codex/selling-onboarding-preview`
Public deployment: none

## Technical checks

- `npm run verify`: passed.
  - ESLint and TypeScript passed.
  - Vitest: 66 files, 441 tests passed.
  - catalog, Barbora coverage and Personal Shelf evidence validators passed.
  - Next.js production build passed.
- `CI=1 WTP_PAYWALL_ENABLED=true E2E_PORT=3112 npm run test:e2e`: 67/67 Mobile Safari scenarios passed.
- Targeted onboarding checks passed for:
  - in-store and at-home branching;
  - no camera permission before the final scanner action;
  - native share and clipboard fallback;
  - clean saved URL with no acquisition, session or personal data;
  - saved-link return event;
  - modal focus trap, Escape dismissal, focus restoration, touch targets and axe accessibility;
  - 320-440 px portrait and phone-landscape layouts;
  - reduced-motion behavior;
  - paywall flow with the experiment flag enabled.

The development server emitted existing non-fatal image aspect-ratio and cancelled-request warnings during parallel browser teardown. No test failed and the production build completed.

## Product checks for Anastasiia

Use the local preview with `?onboarding=1`:

1. Tap `Scan the shelf in front of me` and confirm the offer appears without a camera prompt.
2. Go back, tap `Not shopping yet — show me a sample`, reveal the sample and continue to the offer.
3. Confirm the cupboard-photo hint and `Save it for my next shop` appear only on the at-home route.
4. Open the save sheet and send the link to Messages, WhatsApp or Notes.
5. Open the saved link and confirm the onboarding starts normally.
6. Confirm the copy, spacing and primary action feel clear on the real iPhone.

Do not start Meta spend until the same checks pass on the HTTPS pilot and its live paywall is explicitly enabled and verified.
