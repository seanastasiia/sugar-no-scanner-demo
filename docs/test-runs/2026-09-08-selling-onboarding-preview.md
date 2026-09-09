# Selling onboarding preview — test log

Date: 2026-09-08
Branch: `codex/selling-onboarding-preview`
Base commit: `f4c185d4fe9665f83ec1e1ce4acd70e2c669a47e`

## Technical checks

| Check | Result |
| --- | --- |
| `npm run verify` | PASS — lint, typecheck, 66 unit/API files and 437 tests, all three catalog validators, production build and standalone asset preparation |
| Selling-onboarding Mobile Safari scenarios | PASS — 6/6: camera gating, embedded sample reveal, express offer path, anonymous funnel analytics, persisted/forced onboarding and reduced motion |
| Pen/iPhone viewport matrix | PASS — 320×568, 375×667, 390×844, 402×874, 440×956, 667×375 and 874×402 |
| Paywall suite with `WTP_PAYWALL_ENABLED=true` | PASS — 7/7: allowance, separation, checkout success, recovery, paid days and renewal |
| Existing large-text/dark-mode and shrinking-feedback regressions, serial | PASS — 3/3 |
| WTP paywall plus launch-isolation regressions with `WTP_PAYWALL_ENABLED=true` | PASS — 8/8 on a fresh environment with the experiment flag enabled |
| `git diff --check` | PASS |

The first broad browser invocation accidentally left `WTP_PAYWALL_ENABLED=false`; the paywall file therefore reported expected missing-paywall failures. It was rerun with the experiment flag enabled and passed 7/7. Two visual tests that timed out while the development server was overloaded by five parallel workers passed when rerun serially. These configuration/transient failures are not recorded as product passes until their corrected reruns above.

## Visual review

- Portrait screenshots were inspected at 320×568 and 390×844.
- Landscape was inspected at 667×375 after moving actions into a dedicated right column and compressing supporting copy.
- Primary and secondary actions remain visible without scrolling on the first screen.
- Reduced motion removes the sample scan line.
- Claude's growth-design review was applied selectively: the non-functional question and generic confirmation copy were removed, proof and price copy were strengthened, and an express route was added. Preference-based sugar-only ranking was rejected because the product uses a fixed sugar-plus-protein Sugar.no fit.
- The first screen now keeps the result unrevealed: it confirms four packages were found, while the exact winner and nutrition values appear only after `Scan this shelf`. Anonymous analytics records the chosen sample/express path and the sample reveal without collecting product identity.

## Owner product check

1. Open the isolated preview with `?onboarding=1` on iPhone Safari.
2. Confirm the first screen matches the ad promise and both actions fit without scrolling.
3. Tap `Try it on this shelf`, then `Scan this shelf`; confirm the named product and its confirmed sugar/protein values appear before any camera prompt.
4. Confirm `Explore all 4 results` opens the deterministic sample without requesting camera permission.
5. Return with `?onboarding=1`, choose `Scan my shelf now`, and confirm it goes to the offer without requesting the camera.
6. Confirm `Start my 3 free scans` opens the camera and the offer clearly says €2.99 once, 7 days, no subscription, and that failed/unverified scans do not count.
7. Complete one successful real scan, one unverified scan and the three-free-scan/paywall path before considering a traffic experiment.

No current pilot, staging or production deployment was changed by this preview.
