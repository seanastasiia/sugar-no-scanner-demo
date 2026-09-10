import { beforeEach, describe, expect, it, vi } from "vitest";

const capi = vi.hoisted(() => ({ deliverMetaPurchase: vi.fn() }));
vi.mock("@/server/meta-capi", () => capi);
const helpers = vi.hoisted(() => ({ activateCheckout: vi.fn(), billingEnabled: vi.fn(), getStripe: vi.fn() }));
vi.mock("@/server/billing", () => helpers);
import { POST } from "./route";

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    capi.deliverMetaPurchase.mockReset();
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
    expect(capi.deliverMetaPurchase).not.toHaveBeenCalled();
  });

  it("returns a retryable failure after paid access is granted if Meta is unavailable", async () => {
    const session = { id: "cs_paid", metadata: { access_token_hash: "c".repeat(64) } };
    helpers.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn(() => ({ type: "checkout.session.completed", created: 123, data: { object: session } })) } });
    helpers.activateCheckout.mockResolvedValue({ expiresAt: "later" });
    capi.deliverMetaPurchase.mockRejectedValue(new Error("temporary"));
    const response = await POST(new Request("https://staging.example/api/billing/webhook", {
      method: "POST", headers: { "stripe-signature": "valid" }, body: "payload"
    }));
    expect(response.status).toBe(503);
    expect(capi.deliverMetaPurchase).toHaveBeenCalledWith(session, 123);
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
