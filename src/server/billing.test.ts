import { describe, expect, it } from "vitest";
import { checkoutOrigin, hashAccessToken, hashRestoreToken } from "./billing";

describe("billing helpers", () => {
  it("uses separated one-way token namespaces", () => {
    const token = "11111111-1111-4111-8111-111111111111";
    expect(hashAccessToken(token)).toHaveLength(64);
    expect(hashRestoreToken(token)).toHaveLength(64);
    expect(hashAccessToken(token)).not.toBe(hashRestoreToken(token));
  });

  it("uses the forwarded staging origin for Stripe redirects", () => {
    const before = process.env.APP_BASE_URL;
    delete process.env.APP_BASE_URL;
    const request = new Request("http://internal:3000/api/billing/checkout", { headers: {
      host: "scanner-staging.example", "x-forwarded-proto": "https"
    } });
    expect(checkoutOrigin(request)).toBe("https://scanner-staging.example");
    if (before === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = before;
  });
});
