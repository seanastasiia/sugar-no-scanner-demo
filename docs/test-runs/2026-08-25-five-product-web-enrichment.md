# Five-product automatic web enrichment release

Date: 2026-08-25

Feature commit: `f81dc92b98ea66236b40a83ae93331e875f89a68`

Railway direct deployment: `4cc95e6b-a7dc-4552-8012-2e92f8ade593` (`SUCCESS`)

## Change under test

- Camera and uploaded-photo results keep at most five high-confidence distinct SKUs.
- Repeated facings are still grouped.
- The visible `Scan nutrition label` recovery was removed.
- After curated/Barbora/Open Food Facts resolution, a high-confidence exact identity may use Gemini Google Search grounding.
- A web result is accepted only with an exact SKU, per-100 basis, confidence at least `0.90` and at least one HTTPS grounding source.
- Multi-section uploads perform external enrichment only once for the final merged five products.
- UI keeps the recognized identities visible and says `Checking exact nutrition online…` until enrichment finishes; unresolved rows end at `Nutrition not verified online`.

## Technical tests

All commands ran against the feature tree before commit.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 23 files, 126 tests |
| `npm run build` | Pass: Next.js production build and standalone assets |
| `CI=1 npm run test:e2e` | Pass: 24/24 Mobile Safari scenarios |
| Mobile matrix | Pass: iPhone 17 Pro portrait/landscape, 375 px small phone, 440 px large phone |
| Accessibility | Pass: automated WCAG A/AA scenario, enlarged text, reduced motion and dark mode |
| Privacy contract | Pass: enrichment receives identities only; API response remains `imageStored: false` |
| Maximum-result guard | Pass: prompt, response schema, upload merge and enrichment API all enforce five |

## Real provider check

A server-side request used the existing Railway secret without printing it. Exact `Sproud Barista pea drink 1 L` resolved through grounded web search in about four seconds with:

- Protein: `2 g / 100 ml`
- Total sugar: `1.9 g / 100 ml`
- complete two-factor Sugar.no fit
- HTTPS grounding sources present

Malformed JSON, no citation, non-exact identity and confidence below `0.90` are unit-tested fail-closed cases.

## Production smoke

After the direct Railway deployment:

- `/` returned `200` and rendered the Sugar.no scanner shell.
- `/api/health` returned `200` and `status: ok`.
- `/api/resolve-products` rejected six detections with `400`.
- A single exact Sproud identity returned `200`, one `web_search` detection, a complete fit, Protein `2`, Sugar `1.9`, three source records and `imageStored: false`.

## Product checks for the owner

1. Open the production URL on iPhone Safari and scan a shelf with more than five readable products.
2. Confirm no more than five distinct product cards appear and repeated facings count once.
3. Confirm the first state says it is checking exact nutrition online instead of showing a premature `0 with Sugar.no fit` result.
4. Wait for the check: rated products should move into `Best fit first`; unresolved products should say `Nutrition not verified online`.
5. Confirm there is no `Scan nutrition label` button.
6. Scan two similar flavors or pack sizes and confirm Sugar.no does not borrow nutrition from the neighboring SKU.
7. Confirm the held result, shelf price and exact Barbora action remain stable while enrichment completes.

## Known limits

- Google Search grounding increases cold-scan latency and can make up to five searches for five unresolved identities; cache hits are faster.
- Exact cited web coverage still does not guarantee a fit for every Latvian private-label or unreadable product.
- This is source-coverage evidence, not a physical-shelf recall or false-positive benchmark.
