import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type Stripe from "stripe";
import { WTP_OFFER_VERSION } from "@/lib/wtp-access";
import { getSupabaseAdmin } from "@/server/supabase";

export function metaPurchaseId(sessionId: string) {
  return `purchase_${createHash("sha256").update(`meta-purchase:${sessionId}`).digest("hex")}`;
}
export function capiEnabled() { return process.env.META_CAPI_ENABLED === "true"; }

export function cleanMetaContext(input: unknown) {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const ua = typeof raw.client_user_agent === "string" ? raw.client_user_agent.slice(0, 500) : "";
  const ip = typeof raw.client_ip_address === "string" ? raw.client_ip_address : "";
  const fbp = typeof raw.fbp === "string" ? raw.fbp : "";
  const fbc = typeof raw.fbc === "string" ? raw.fbc : "";
  return {
    client_user_agent: ua,
    ...(isIP(ip) ? { client_ip_address: ip } : {}),
    ...(/^fb\.\d\.\d{13}\.\d{1,30}$/.test(fbp) ? { fbp } : {}),
    ...(/^fb\.\d\.\d{13}\.[A-Za-z0-9_-]{10,500}$/.test(fbc) ? { fbc } : {})
  };
}

export function metaRequestContext(request: Request) {
  const cookies = request.headers.get("cookie") || "";
  const cookie = (name: string) => cookies.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  const fbp = cookie("_fbp"), fbc = cookie("_fbc");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    client_user_agent: (request.headers.get("user-agent") || "").slice(0, 500),
    ...(ip && isIP(ip) ? { client_ip_address: ip } : {}),
    ...(fbp && /^fb\.\d\.\d{13}\.\d{1,30}$/.test(fbp) ? { fbp } : {}),
    ...(fbc && /^fb\.\d\.\d{13}\.[A-Za-z0-9_-]{10,500}$/.test(fbc) ? { fbc } : {})
  };
}

// Called only after creating Checkout or verifying ownership of an already paid return.
export async function rememberMetaCheckout(sessionId: string, tokenHash: string, consent: boolean, request: Request) {
  if (!capiEnabled() || !consent) return;
  const db = getSupabaseAdmin();
  if (!db) throw new Error("meta_storage_unavailable");
  const context = metaRequestContext(request);
  if (!context.client_user_agent) return;
  const { error } = await db.from("scanner_meta_purchases").upsert({
    checkout_id: sessionId, event_id: metaPurchaseId(sessionId), access_token_hash: tokenHash,
    consent: true, context
  }, { onConflict: "checkout_id", ignoreDuplicates: true });
  if (error) throw new Error("meta_context_storage_failed");
}

export async function revokeMetaConsent(tokenHash: string) {
  if (!capiEnabled()) return;
  const db = getSupabaseAdmin();
  if (!db) throw new Error("meta_storage_unavailable");
  const { error } = await db.from("scanner_meta_purchases").update({ consent: false, context: null })
    .eq("access_token_hash", tokenHash);
  if (error) throw new Error("meta_consent_storage_failed");
}

export function buildPurchaseEvent(session: Stripe.Checkout.Session, eventTime: number, context: ReturnType<typeof metaRequestContext>) {
  if (session.payment_status !== "paid" || session.metadata?.offer_version !== WTP_OFFER_VERSION
    || session.currency !== "eur" || !session.amount_total || session.amount_total <= 0) return null;
  const base = process.env.APP_BASE_URL;
  if (!base) throw new Error("meta_base_url_missing");
  return {
    event_name: "Purchase", event_time: eventTime, event_id: metaPurchaseId(session.id),
    action_source: "website", event_source_url: `${new URL(base).origin}/`,
    user_data: cleanMetaContext(context), custom_data: { value: session.amount_total / 100, currency: "EUR" }
  };
}

export async function deliverMetaPurchase(session: Stripe.Checkout.Session, eventTime: number) {
  if (!capiEnabled()) return "disabled";
  if (session.payment_status !== "paid" || session.metadata?.offer_version !== WTP_OFFER_VERSION
    || session.currency !== "eur" || !session.amount_total || session.amount_total <= 0) return "ineligible";
  const db = getSupabaseAdmin();
  if (!db) throw new Error("meta_storage_unavailable");
  const attempt = randomUUID();
  const { data: claim, error } = await db.rpc("claim_scanner_meta_purchase", {
    p_checkout_id: session.id, p_event_time: eventTime, p_attempt_id: attempt
  });
  if (error || !claim) throw new Error("meta_claim_failed");
  if (claim.state === "busy") throw new Error("meta_delivery_busy");
  if (claim.state !== "claimed") return claim.state as string;
  try {
    const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
    const pixel = process.env.META_PIXEL_ID?.trim();
    const version = process.env.META_GRAPH_API_VERSION || "v26.0";
    if (!token || !pixel || !/^\d{5,25}$/.test(pixel) || !/^v\d+\.0$/.test(version)) throw new Error("meta_config_missing");
    // Recheck revocation immediately before transport; in-flight requests cannot be recalled.
    const { data: current, error: readError } = await db.from("scanner_meta_purchases").select("consent")
      .eq("checkout_id", session.id).single();
    if (readError) throw new Error("meta_consent_read_failed");
    if (!current?.consent) return "revoked";
    const event = buildPurchaseEvent(session, claim.event_time, claim.context);
    if (!event) return "ineligible";
    const response = await fetch(`https://graph.facebook.com/${version}/${pixel}/events`, {
      method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: [event] }), signal: AbortSignal.timeout(8_000)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.events_received !== 1) throw new Error("meta_delivery_failed");
    const { error: markError } = await db.from("scanner_meta_purchases")
      .update({ delivered_at: new Date().toISOString(), context: null, lease_until: null })
      .eq("checkout_id", session.id).eq("attempt_id", attempt);
    if (markError) throw new Error("meta_receipt_storage_failed");
    return "delivered";
  } finally {
    // Same stable event ID/time makes retry safe even if Meta accepted before a storage failure.
    await db.from("scanner_meta_purchases").update({ lease_until: null })
      .eq("checkout_id", session.id).eq("attempt_id", attempt);
  }
}
