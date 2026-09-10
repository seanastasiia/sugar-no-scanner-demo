import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { WTP_OFFER_VERSION } from "@/lib/wtp-access";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => mocks }));
import { buildPurchaseEvent, deliverMetaPurchase, metaPurchaseId, metaRequestContext, rememberMetaCheckout, revokeMetaConsent } from "./meta-capi";
const session = { id: "cs_test_verified", payment_status: "paid", amount_total: 299, currency: "eur", metadata: {
  offer_version: WTP_OFFER_VERSION, product: "never-share", email: "never-share@example.test"
}, customer_email: "private@example.test" } as unknown as Stripe.Checkout.Session;
let query: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.stubEnv("META_CAPI_ENABLED", "true"); vi.stubEnv("META_CAPI_ACCESS_TOKEN", "private-token");
  vi.stubEnv("META_PIXEL_ID", "1956266218377681"); vi.stubEnv("APP_BASE_URL", "https://scanner.test/private?token=secret");
  query = Object.fromEntries(["upsert", "update", "eq", "select"].map(key => [key, vi.fn(() => query)]));
  query.single = vi.fn().mockResolvedValue({ data: { consent: true }, error: null });
  mocks.from.mockReturnValue(query);
  mocks.rpc.mockResolvedValue({ data: { state: "claimed", context: { client_user_agent: "QA" }, event_time: 123456 }, error: null });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ events_received: 1 })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("server Purchase privacy and delivery", () => {
  it("uses the same hashed browser ID and a closed payload with clean root URL", () => {
    const event = buildPurchaseEvent(session, 123, { client_user_agent: "QA" });
    expect(event).toEqual({ event_name: "Purchase", event_time: 123, event_id: metaPurchaseId(session.id), action_source: "website",
      event_source_url: "https://scanner.test/", user_data: { client_user_agent: "QA" }, custom_data: { value: 2.99, currency: "EUR" } });
    expect(JSON.stringify(event)).not.toContain("private");
    expect(event?.event_id).toMatch(/^purchase_[a-f0-9]{64}$/);
  });
  it.each(["unpaid", "no_payment_required"])("does not report %s checkout", async payment_status => {
    expect(await deliverMetaPurchase({ ...session, payment_status } as Stripe.Checkout.Session, 123)).toBe("ineligible");
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("ignores non-scanner offers and unsupported currency", async () => {
    expect(buildPurchaseEvent({ ...session, currency: "usd" }, 123, { client_user_agent: "QA" })).toBeNull();
    expect(buildPurchaseEvent({ ...session, metadata: {} }, 123, { client_user_agent: "QA" })).toBeNull();
  });
  it("captures only bounded matching fields, no arbitrary cookies or URLs", () => {
    const data = metaRequestContext(new Request("https://scanner.test/?private=secret", { headers: {
      "user-agent": "QA", "x-forwarded-for": "192.0.2.1, 10.0.0.1",
      cookie: "email=private; _fbp=fb.1.1234567890123.1234567; _fbc=invalid"
    } }));
    expect(data).toEqual({ client_user_agent: "QA", client_ip_address: "192.0.2.1", fbp: "fb.1.1234567890123.1234567" });
  });
  it("stores nothing without consent or when disabled", async () => {
    await rememberMetaCheckout(session.id, "a".repeat(64), false, new Request("https://scanner.test"));
    vi.stubEnv("META_CAPI_ENABLED", "false");
    await rememberMetaCheckout(session.id, "a".repeat(64), true, new Request("https://scanner.test"));
    expect(await deliverMetaPurchase(session, 123)).toBe("disabled"); expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each(["no_consent", "already_delivered", "expired"])("skips %s records", async state => {
    mocks.rpc.mockResolvedValue({ data: { state }, error: null });
    expect(await deliverMetaPurchase(session, 123)).toBe(state); expect(fetch).not.toHaveBeenCalled();
  });
  it("asks Stripe to retry concurrent delivery, without another send", async () => {
    mocks.rpc.mockResolvedValue({ data: { state: "busy" }, error: null });
    await expect(deliverMetaPurchase(session, 123)).rejects.toThrow("meta_delivery_busy"); expect(fetch).not.toHaveBeenCalled();
  });
  it("rechecks withdrawal and clears server matching data on revoke", async () => {
    query.single.mockResolvedValue({ data: { consent: false }, error: null });
    expect(await deliverMetaPurchase(session, 123)).toBe("revoked"); expect(fetch).not.toHaveBeenCalled();
    await revokeMetaConsent("a".repeat(64));
    expect(query.update).toHaveBeenCalledWith({ consent: false, context: null });
  });
  it("records success only after Meta acknowledges and excludes test code from production", async () => {
    expect(await deliverMetaPurchase(session, 123)).toBe("delivered");
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toEqual({ data: [buildPurchaseEvent(session, 123456, { client_user_agent: "QA" })] });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ delivered_at: expect.any(String), context: null }));
  });
  it("releases failed attempts, retaining the stable ID/time on retry", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: {} }, { status: 500 }));
    await expect(deliverMetaPurchase(session, 123)).rejects.toThrow("meta_delivery_failed");
    expect(query.update).not.toHaveBeenCalledWith(expect.objectContaining({ delivered_at: expect.any(String) }));
    expect(query.update).toHaveBeenCalledWith({ lease_until: null });
    await deliverMetaPurchase(session, 456);
    const bodies = vi.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(String(options?.body)));
    expect(bodies[0]).toEqual(bodies[1]);
  });
});
