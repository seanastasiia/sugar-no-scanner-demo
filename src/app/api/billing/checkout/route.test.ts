import { beforeEach, describe, expect, it, vi } from "vitest";

const { billingEnabled, getStripe, hashAccessToken } = vi.hoisted(() => ({
  billingEnabled: vi.fn(), getStripe: vi.fn(), hashAccessToken: vi.fn(() => "a".repeat(64))
}));
vi.mock("@/server/billing", async () => ({
  billingEnabled, getStripe, hashAccessToken,
  checkoutOrigin: () => "https://staging.example"
}));

import { POST } from "./route";

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    billingEnabled.mockReset();
    getStripe.mockReset();
    hashAccessToken.mockClear();
    billingEnabled.mockReturnValue(true);
    process.env.STRIPE_PRICE_ID = "price_test_299";
  });

  it("creates a one-time hosted checkout without renewal", async () => {
    const create = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    getStripe.mockReturnValue({ checkout: { sessions: { create } } });
    const response = await POST(new Request("https://staging.example/api/billing/checkout", {
      method: "POST", headers: { origin: "https://staging.example", "content-type": "application/json" },
      body: JSON.stringify({
        accessToken: "11111111-1111-4111-8111-111111111111",
        browserSessionId: "22222222-2222-4222-8222-222222222222",
        scanSource: "camera",
        attribution: { utm_source: "meta", utm_campaign: "riga" }
      })
    }));
    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment", line_items: [{ price: "price_test_299", quantity: 1 }],
      allow_promotion_codes: false,
      success_url: "https://staging.example/api/billing/return?session_id={CHECKOUT_SESSION_ID}",
      metadata: expect.objectContaining({ access_token_hash: "a".repeat(64), scan_source: "camera", utm_source: "meta" })
    }));
  });

  it("rejects cross-origin checkout creation", async () => {
    const response = await POST(new Request("https://staging.example/api/billing/checkout", {
      method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: "{}"
    }));
    expect(response.status).toBe(403);
    expect(getStripe).not.toHaveBeenCalled();
  });
});
