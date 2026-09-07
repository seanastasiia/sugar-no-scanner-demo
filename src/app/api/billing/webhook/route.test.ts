import { beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({ activateCheckout: vi.fn(), billingEnabled: vi.fn(), getStripe: vi.fn() }));
vi.mock("@/server/billing", () => helpers);
import { POST } from "./route";

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    helpers.billingEnabled.mockReturnValue(true);
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("verifies the Stripe signature before granting access", async () => {
    helpers.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn(() => { throw new Error("bad signature"); }) } });
    const response = await POST(new Request("https://staging.example/api/billing/webhook", {
      method: "POST", headers: { "stripe-signature": "bad" }, body: "payload"
    }));
    expect(response.status).toBe(400);
    expect(helpers.activateCheckout).not.toHaveBeenCalled();
  });

  it("activates only a signed completed Checkout session", async () => {
    const session = { id: "cs_paid", metadata: { access_token_hash: "c".repeat(64) } };
    helpers.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn(() => ({ type: "checkout.session.completed", data: { object: session } })) } });
    helpers.activateCheckout.mockResolvedValue({ expiresAt: "later" });
    const response = await POST(new Request("https://staging.example/api/billing/webhook", {
      method: "POST", headers: { "stripe-signature": "valid" }, body: "payload"
    }));
    expect(response.status).toBe(200);
    expect(helpers.activateCheckout).toHaveBeenCalledWith(session, "c".repeat(64));
  });
});
