# Onboarding v10 candidate — 21 September 2026

Base: `origin/main` at `f09ab2380d79914df38be4cfcefa7b49d4a0b850`. Local candidate only; no GitHub push, Railway deployment or Meta edit. Production remains onboarding v9.

## Read-only diagnosis

- Production Supabase `scan_events`, 18–21 September inclusive of the partial 21 September: 336 distinct sessions carrying `utm_campaign=shelf_lv_pilot_02`, 332 onboarding starts, 11 path selections. An onboarding start is automatic on arrival and does not prove a person acted.
- UTM attribution persists in browser storage. These sessions can include repeat and QA visits and must not be divided into Meta's landing-page-view count as a strict conversion rate.
- Live Meta Ads Manager through 20 September: campaign active, EUR 45.16 spent / 12,822 impressions; Video A EUR 39.09, Static D EUR 5.03, Static C EUR 1.04. Static B remains off. Creative comparison is too small and unbalanced to claim a winner.
- Live first-screen controls were visible without scrolling at 390 × 844 and 375 × 667. The evidence points to a first-action/value/context problem, not a proven recognition outage. This is a hypothesis for the copy candidate.

## Candidate

- First-screen copy explicitly tells out-of-store visitors to try the four-bar sample or save the scanner for the next shop.
- The existing save action becomes an outlined button. Sample and real-camera actions retain their order and behavior; no consent, nutrition, price, payment, recognition or sharing logic changes.
- Anonymous onboarding events carry version 10 for a later pre/post analysis. Sample completion remains separate from real camera/upload scans.

## Checks

- `npm run typecheck`: pass.
- Targeted ESLint of touched TS/TSX files: 0 errors; 1 pre-existing `react-hooks/exhaustive-deps` warning in `scanner-app.tsx:676`.
- Mobile Safari first-visit onboarding test: pass, including CTA visibility, contrast/accessibility and no camera request before choice.
- Mobile Safari cross-iPhone/rotation layout test: pass.
- Mobile Safari saved-link return and copy/focus tests: 2 pass.
- `npm run build`: pass.
- `npm run test:e2e:smoke`: 2 pass, checkout-photo test hit the 30-second timeout after reaching its product detail. Isolated checkout-photo rerun with a 60-second timeout: pass.
- Repeated three-scenario smoke with 60-second timeout: checkout-photo and online-enrichment pass; sample-shelf test timed out, although it passed in the earlier run. This is an unresolved local harness intermittency, not a green full smoke run.
- `git diff --check`: pass.

Owner product checks after any approved release: open the ad destination on an iPhone in Instagram and Safari; verify the first screen explains what to do away from a shop, all three actions are visible and tappable, the sample ranks four bars without camera permission, Save sends a clean link, and the real scan still requests camera only after choosing it. Then compare version 10's path-selection, save, sample and real-scan rates with version 9 on comparable traffic. Do not count sample scans as shopper scans or purchases.
