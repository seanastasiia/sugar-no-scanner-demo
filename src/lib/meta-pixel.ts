// Meta receives only this closed funnel, never scanner analytics metadata.
export const META_CONSENT_KEY = "sugar-scanner-meta-consent-v1";
type Consent = "granted" | "denied";
type Pixel = ((...args: unknown[]) => void) & {
  queue: unknown[][]; callMethod?: (...args: unknown[]) => void;
  push?: Pixel; loaded: boolean; version: string;
};
declare global { interface Window { fbq?: Pixel; _fbq?: Pixel } }
let pixelId = "";
let initialized = false;
let pageViewed = false;
let consent: Consent | null = null;
let pendingPurchase: { eventId: string; value: number; currency: string } | null = null;
const sentPurchases = new Set<string>();

export function readMetaConsent(): Consent | null {
  try {
    const value = localStorage.getItem(META_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch { return null; }
}

export function configureMeta(id: string) {
  pixelId = /^\d{5,25}$/.test(id) ? id : "";
  consent = readMetaConsent();
}

export function setMetaConsent(value: Consent) {
  consent = value;
  try { localStorage.setItem(META_CONSENT_KEY, value); } catch { /* Session-only choice. */ }
  if (value === "granted" && initialized) window.fbq?.("consent", "grant");
  if (value === "denied") {
    pendingPurchase = null;
    if (window.fbq) {
      if (Array.isArray(window.fbq.queue)) {
        window.fbq.queue = window.fbq.queue.filter(args => !String(args[0]).startsWith("track") && !(args[0] === "consent" && args[1] === "grant"));
      }
      window.fbq("consent", "revoke");
    }
    for (const name of ["_fbp", "_fbc"]) {
      const parts = location.hostname.split(".");
      document.cookie = `${name}=; Max-Age=0; Path=/`;
      for (let i = 0; i < parts.length - 1; i++) {
        document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${parts.slice(i).join(".")}`;
      }
    }
  }
}

// Detailed referrers must never reach third-party analytics, including Stripe return paths.
export function hasPrivateReferrer(): boolean {
  if (!document.referrer) return false;
  try {
    const ref = new URL(document.referrer);
    return ref.pathname !== "/" || !!ref.search || !!ref.hash;
  } catch { return true; }
}

export function startMeta(): boolean {
  if (!pixelId || consent !== "granted" || location.pathname !== "/") return false;
  const url = new URL(location.href);
  // Billing must consume and remove its tokens before any third-party script loads.
  if (["checkout", "session_id", "restore"].some(key => url.searchParams.has(key))) return false;
  if (hasPrivateReferrer()) return false;
  // Scanner captures attribution first. Never expose arbitrary URL text to Meta.
  const clickId = url.searchParams.get("fbclid");
  url.search = "";
  url.hash = "";
  if (clickId && /^[A-Za-z0-9_-]{10,500}$/.test(clickId)) url.searchParams.set("fbclid", clickId);
  if (url.href !== location.href) history.replaceState(history.state, "", url.href);
  if (!initialized) {
    const fbq: Pixel = Object.assign((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    }, { queue: [] as unknown[][], loaded: true, version: "2.0" });
    fbq.push = fbq;
    window.fbq = window._fbq = fbq;
    // Loading is already consent-gated. An initial revoke would pause SDK queue draining.
    fbq("set", "autoConfig", false, pixelId);
    fbq("init", pixelId);
    const script = document.createElement("script");
    script.id = "scanner-meta-pixel";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.referrerPolicy = "no-referrer";
    document.head.appendChild(script);
    initialized = true;
  }
  if (!pageViewed) window.fbq?.("consent", "grant");
  if (!pageViewed) {
    window.fbq?.("trackSingle", pixelId, "PageView");
    pageViewed = true;
  }
  if (pendingPurchase) {
    const purchase = pendingPurchase;
    pendingPurchase = null;
    trackMetaPurchase(purchase);
  }
  return true;
}

export function trackMetaFunnel(name: string) {
  if (consent !== "granted" || !initialized) return;
  const custom = name === "onboarding_completed" ? "OnboardingCompleted" : name === "paywall_viewed" ? "PaywallViewed" : null;
  if (custom) window.fbq?.("trackSingleCustom", pixelId, custom);
  if (name === "checkout_started") window.fbq?.("trackSingle", pixelId, "InitiateCheckout", { currency: "EUR", value: 2.99 });
}

export function trackMetaPurchase(purchase: { eventId: string; value: number; currency: string }) {
  if (consent !== "granted" || !/^purchase_[a-f0-9]{64}$/.test(purchase.eventId)
    || !Number.isFinite(purchase.value) || purchase.value <= 0 || purchase.currency !== "EUR") return;
  if (!initialized) { pendingPurchase = purchase; return; }
  const key = `sugar-meta-${purchase.eventId}`;
  try { if (localStorage.getItem(key)) return; } catch { /* In-memory deduplication remains. */ }
  if (sentPurchases.has(key)) return;
  sentPurchases.add(key);
  window.fbq?.("trackSingle", pixelId, "Purchase", { value: purchase.value, currency: purchase.currency }, { eventID: purchase.eventId });
  try { localStorage.setItem(key, "1"); } catch { /* Session-only deduplication. */ }
}
