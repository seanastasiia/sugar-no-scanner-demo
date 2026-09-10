import { beforeEach, describe, expect, it, vi } from "vitest";

async function setup(granted = false) {
  if (granted) localStorage.setItem("sugar-scanner-meta-consent-v1", "granted");
  const meta = await import("./meta-pixel");
  meta.configureMeta("1956266218377681");
  return meta;
}
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetModules(); localStorage.clear(); document.head.innerHTML = "";
  delete window.fbq; delete window._fbq;
  history.replaceState({}, "", "/");
});
describe("Meta privacy boundary", () => {
  it("makes no script or event queue before consent, or after rejection", async () => {
    const meta = await setup();
    expect(meta.startMeta()).toBe(false);
    meta.trackMetaFunnel("checkout_started");
    meta.setMetaConsent("denied");
    expect(meta.startMeta()).toBe(false);
    expect(window.fbq).toBeUndefined();
    expect(document.querySelector("script")).toBeNull();
  });
  it("initializes once, disables automatic collection and strips arbitrary URL text", async () => {
    history.replaceState({}, "", "/?utm_content=private@example.com&product=secret#secret");
    const meta = await setup(true);
    meta.startMeta(); meta.startMeta();
    expect(location.search).toBe(""); expect(location.hash).toBe("");
    expect(document.querySelectorAll("script")).toHaveLength(1);
    expect(window.fbq?.queue).toEqual([
      ["set", "autoConfig", false, "1956266218377681"],
      ["init", "1956266218377681"], ["consent", "grant"],
      ["trackSingle", "1956266218377681", "PageView"]
    ]);
  });
  it("waits for billing URLs to be consumed and does not load on other pages", async () => {
    const meta = await setup(true);
    for (const path of ["/?session_id=secret", "/?restore=secret", "/?checkout=success", "/demo/personal-shelf"]) {
      history.replaceState({}, "", path); expect(meta.startMeta()).toBe(false);
    }
    expect(document.querySelector("script")).toBeNull();
  });
  it("does not expose a detailed referrer to the SDK", async () => {
    const meta = await setup(true);
    vi.spyOn(document, "referrer", "get").mockReturnValue("https://checkout.example/pay/private-token");
    expect(meta.startMeta()).toBe(false);
    expect(document.querySelector("script")).toBeNull();
  });
  it("only sends allowlisted funnel events, discards scanner events, and revokes queued events", async () => {
    const meta = await setup(true); meta.startMeta();
    const fbq = window.fbq!; fbq.queue = [];
    for (const name of ["scan_completed", "product_clicked", "feedback_submitted", "access_restored", "checkout_completed", "constructor", "__proto__"]) meta.trackMetaFunnel(name);
    expect(fbq.queue).toEqual([]);
    meta.trackMetaFunnel("onboarding_completed"); meta.trackMetaFunnel("checkout_started");
    expect(fbq.queue).toHaveLength(2);
    meta.setMetaConsent("denied"); meta.trackMetaFunnel("checkout_started");
    expect(fbq.queue).toEqual([["consent", "revoke"]]);
  });
  it("sends a verified pending purchase after initialization, once across reloads", async () => {
    const purchase = { eventId: `purchase_${"a".repeat(64)}`, value: 2.99, currency: "EUR" };
    const meta = await setup(true);
    meta.trackMetaPurchase(purchase); meta.startMeta(); meta.trackMetaPurchase(purchase);
    expect(window.fbq?.queue.filter(args => args[2] === "Purchase")).toHaveLength(1);
    vi.resetModules();
    const reloaded = await import("./meta-pixel"); reloaded.configureMeta("1956266218377681"); reloaded.startMeta(); reloaded.trackMetaPurchase(purchase);
    expect(window.fbq?.queue.filter(args => args[2] === "Purchase")).toHaveLength(0);
  });
});
