# Dedicated Meta source verification

Base revision: 486141ce2e167b864b05f4b0b55229879703ca12.

- Created dataset 1084452794318316 in portfolio 1417190093846600 and linked ad account 1583725946785400. Meta confirmed creation and connection.
- Authorized direct-integration token stored only in Railway META_CAPI_ACCESS_TOKEN. Token-only deployment 9ceb78b3-e56a-4045-833f-33edb46ad6fd succeeded at the base revision; CAPI remained disabled during QA.
- Test-only transport script check-meta-capi.ts: two HTTP 200 responses, events_received=1 each, same qa_purchase_0bb54fd6-70a0-4494-891f-a60246266ab3. Meta Test Events visibly showed two Server / Processed rows at 09:20:42 Riga. Meta deduplication is NOT established by these rows. No Stripe charge or production receipt created.
- Expanded event: root URL only, value 2.99, currency EUR, website action source, IP/User-Agent only.
- 9 focused Vitest files / 43 tests passed covering consent sync, Pixel queue, CAPI, actual migration permissions/lease/expiry and billing checkout/status/return/webhook.
- New dataset category Health and wellness – other; Core setup on. Automatic website matching and automatic events off. Category restrictions may affect production even when Test Events succeeds.

Remaining product check: consent decline, consent grant with PageView on new source, real previously paid return only from its owning browser, matched browser/server event IDs, withdrawal and no duplicate return purchase. Real payment is not required just to test.

Full verification on base 486141c: npm run verify passed, 96 Vitest files / 801 tests plus lint, typecheck, catalog validation and build. Actual Meta SDK test with new dataset ID passed locally intercepted PageView/Purchase/OnboardingCompleted and withdrawal. Four production-build Mobile Safari Meta cases passed (8.7 seconds), including consent refusal, URL cleanup, narrow-screen placement and single paid-return Purchase. No real charge occurred.

Final validation after incorporating origin/main b9ac3f1 (dense-shelf work) into this documentation change: npm run verify passed 96 files / 802 tests, lint/typecheck/catalog/build. Four enabled-Meta production-browser cases passed again (7.0 seconds). No Meta or billing runtime code changed between the two validations. Final live configuration and deployment are recorded in the shared handoff after verification.
