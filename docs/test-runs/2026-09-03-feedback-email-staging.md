# Staging feedback email verification

- Scope: new owner notifications only, no production deploy, UI, schema, catalog, fit, recognition or analytics changes.
- Implementation tested: `6a153894ddbed727e3756875fdbb3f9b76b3f6c6`, based on Pen staging `c151e92a793714b7f4b9e6869bb168efbedbb9f7`.
- Dedicated Resend sending-only key, restricted to `marketing.intend.com`. Existing key/domain/account settings unchanged.
- Approved sender: `scanner@marketing.intend.com`; sole recipient: `anastasiia@sugar.no`.
- Resend usage before enablement: Free transactional, 0/100 daily and 0/3000 monthly. No billing changes.

## Technical checks

- `npx vitest run src/server/feedback-email.test.ts src/app/api/feedback/route.test.ts`: 25/25 passed.
- `npm run verify`: passed, lint, TypeScript, 49 files / 269 unit tests, catalog validation and production build.
- `CI=1 E2E_PORT=3016 npm run test:e2e`: 41 passed, 1 flaky (passed on first retry), 1 failed. This is not a fully green suite.
- Failed viewport scenario: sheet bottom 980, expected <=957, after resizing/collapsing results at `tests/e2e/scanner.spec.ts:992`. Reproduced independently on clean parent `c151e92` with `CI=1 E2E_PORT=3017 npx playwright test --retries=0 --grep 'camera and results fit iPhone 17 Pro'`. Not introduced by notifications.
- Flaky alternative-carousel scenario: ArrowRight initially did not move scrollLeft; passed on retry. Both are recorded in Bugs.md, with no UI changes in this task.
- Existing development warnings: SVG sizing, NO_COLOR, and aborted requests during navigation.
- E2E configuration explicitly disables mail and clears the mail key; test runs send no real emails.

## Email behavior covered

- Production/local environments and disabled flag send nothing.
- Invalid/missing configuration fails without throwing; multiple recipients and header injection are rejected.
- Only owner-configured sender/recipient; user comment is plain text, never headers/HTML.
- Successful DB insertion precedes background scheduling. Validation/storage failures and local log fallback send nothing.
- API returns storage success before mail finishes; even scheduling failures preserve success.
- Network/5xx retry has a 3-second attempt deadline, one retry, and identical body/idempotency key. Permanent/quota errors do not retry.
- Logs contain outcome, feedback ID and provider email ID only, not credentials or user comments.

## Owner product check after deployment

1. Open staging and submit a clearly marked QA feedback through Leave feedback.
2. Confirm the success screen appears and the matching `pilot_feedback` row exists.
3. Confirm the email arrives at the approved recipient with rating, reason and comment.
4. Check Resend delivery status; provider acceptance alone is not proof of inbox placement.
5. Confirm production `/api/health` is unchanged.

Live verification is recorded after deployment in ignored `test-results/feedback-email-live-verification.md` and the shared Sugar.no update. Email is best-effort, not a durable queue; saved feedback remains the source of truth.
