# Verified source resolution — 2026-09-07

## Scope

- Prefer a complete exact Barbora/Rimi product over an identity-only Open Food Facts record.
- Reconcile reviewed English/Latvian Pringles sour-cream-and-onion identities by exact flavour and observed pack.
- Continue the bounded resolution ladder after incomplete retailer, shared-web or OFF candidates; use identity-only only when no complete nutrition source succeeds.
- Preserve the existing Personal Fit formula, weights, evidence and rating output.

## Technical checks

- `npm run check:fast` — passed: ESLint, TypeScript, 75 Vitest files and 676 tests.
- Focused resolver suite — passed: 71 tests across recognition, external-catalog, detection-deduplication and rating-visibility modules.
- Regression coverage includes exact Pringles 70 g and 165 g retailer matching, OFF-identity-to-Rimi reconciliation, and continued lookup after three identity-only candidates.
- `npm run build` — passed: Next.js 16.3.1 production build and standalone asset preparation.
- Targeted Mobile Safari smoke — passed: Personal Shelf stays opt-in and leaves original Fit unchanged; a truly exhausted visual-only result is removed only after pending enrichment ends (2 tests).
- Railway health/revision checks are recorded below after release.

## Product checks

1. Upload the same Pringles shelf photo and wait for `Checking Sugar.no signals…` to finish.
2. Confirm readable Sour Cream & Onion 70 g/165 g packages use a rated Barbora/Rimi-backed card rather than `Nutrition not verified` from OFF.
3. Confirm repeated recognition of that exact pack produces one product card, not separate OFF and retailer cards.
4. Confirm a different flavour or conflicting pack is not merged into this card.
5. Enable Personal Shelf Rank and confirm its score/order is unchanged for the same selected source evidence.

## Release status

Implementation verified locally on `codex/personal-fit-criteria-summary`; publication evidence will be appended after the owner-authorized `main` and Railway release.
