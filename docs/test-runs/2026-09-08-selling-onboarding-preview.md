# Selling onboarding preview — test log

Date: 2026-09-08  
Branch: `codex/selling-onboarding-preview`  
Base commit: `f4c185d4fe9665f83ec1e1ce4acd70e2c669a47e`

## Technical checks

| Check | Result |
| --- | --- |
| `npm run verify` | PASS — lint, typecheck, 66 unit/API files and 434 tests, all three catalog validators, production build and standalone asset preparation |
| Selling-onboarding Mobile Safari scenarios | PASS — 6/6: camera gating, four-step path, persisted completion, forced QA path, sample without camera permission, anonymous analytics and reduced motion |
| Pen/iPhone viewport matrix | PASS — 320×568, 375×667, 390×844, 402×874, 440×956, 667×375 and 874×402 |
| Paywall suite with `WTP_PAYWALL_ENABLED=true` | PASS — 7/7: allowance, separation, checkout success, recovery, paid days and renewal |
| Existing large-text/dark-mode and shrinking-feedback regressions, serial | PASS — 3/3 |
| `git diff --check` | PASS |

The first broad browser invocation accidentally left `WTP_PAYWALL_ENABLED=false`; the paywall file therefore reported expected missing-paywall failures. It was rerun with the experiment flag enabled and passed 7/7. Two visual tests that timed out while the development server was overloaded by five parallel workers passed when rerun serially. These configuration/transient failures are not recorded as product passes until their corrected reruns above.

## Visual review

- Portrait screenshots were inspected at 320×568 and 390×844.
- Landscape was inspected at 667×375 after moving actions into a dedicated right column and compressing supporting copy.
- Primary and secondary actions remain visible without scrolling on the first screen.
- Reduced motion removes the sample scan line.

## Owner product check

1. Open the isolated preview with `?onboarding=1` on iPhone Safari.
2. Confirm the first screen matches the ad promise and both actions fit without scrolling.
3. Choose each of the three answers and confirm the next and final screens reflect that choice.
4. Tap `Scan this shelf`; confirm the result appears before any camera prompt.
5. Confirm `Try a sample shelf` never requests camera permission.
6. Confirm `Start my 3 free scans` opens the camera and the final card clearly says €2.99, 7 days and no subscription.
7. Complete one successful real scan, one unverified scan and the three-free-scan/paywall path before considering a traffic experiment.

No current pilot, staging or production deployment was changed by this preview.
