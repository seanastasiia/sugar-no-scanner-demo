import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  activateCheckout: vi.fn(), billingEnabled: vi.fn(), getStripe: vi.fn(),
  hashAccessToken: vi.fn(() => "b".repeat(64)), readAccessStatus: vi.fn()
}));
vi.mock("@/server/billing", () => helpers);

import { POST } from "./route";

describe("POST /api/billing/status", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    helpers.billingEnabled.mockReturnValue(true);
    helpers.readAccessStatus.mockResolvedValue(null);
  });

  it("does not unlock from the success URL without server-verified payment", async () => {
    helpers.getStripe.mockReturnValue({ checkout: { sessions: { retrieve: vi.fn().mockResolvedValue({ id: "cs_test", payment_status: "unpaid" }) } } });
    helpers.activateCheckout.mockResolvedValue(null);
    const response = await POST(new Request("https://staging.example/api/billing/status", {
      method: "POST", headers: { origin: "https://staging.example", "content-type": "application/json" },
      body: JSON.stringify({ accessToken: "11111111-1111-4111-8111-111111111111", sessionId: "cs_test" })
    }));
    expect(await response.json()).toEqual({ active: false, expired: false });
  });

  it("returns access only after the paid session is activated", async () => {
    helpers.getStripe.mockReturnValue({ checkout: { sessions: { retrieve: vi.fn().mockResolvedValue({ id: "cs_paid", payment_status: "paid", amount_total: 299, currency: "eur" }) } } });
    helpers.activateCheckout.mockResolvedValue({ expiresAt: "2026-09-14T12:00:00.000Z" });
    const response = await POST(new Request("https://staging.example/api/billing/status", {
      method: "POST", headers: { origin: "https://staging.example", "content-type": "application/json" },
      body: JSON.stringify({ accessToken: "11111111-1111-4111-8111-111111111111", sessionId: "cs_paid" })
    }));
    expect(await response.json()).toEqual({
      active: true,
      expiresAt: "2026-09-14T12:00:00.000Z",
      scanSource: "camera",
      purchase: { eventId: `purchase_${createHash("sha256").update("meta-purchase:cs_paid").digest("hex")}`, value: 2.99, currency: "EUR" }
    });
  });

  it("marks a previous purchase as expired so the client can offer another pass", async () => {
    helpers.readAccessStatus.mockResolvedValue({
      active: false,
      expired: true,
      expiresAt: "2026-09-07T12:00:00.000Z"
    });
    const response = await POST(new Request("https://staging.example/api/billing/status", {
      method: "POST", headers: { origin: "https://staging.example", "content-type": "application/json" },
      body: JSON.stringify({ accessToken: "11111111-1111-4111-8111-111111111111" })
    }));
    expect(await response.json()).toEqual({
      active: false,
      expired: true,
      expiresAt: "2026-09-07T12:00:00.000Z"
    });
  });
});
