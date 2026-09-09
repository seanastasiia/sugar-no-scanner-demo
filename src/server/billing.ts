import { createHash, randomBytes } from "node:crypto";
import Stripe from "stripe";
import { WTP_OFFER_VERSION } from "@/lib/wtp-access";
import { getSupabaseAdmin } from "@/server/supabase";

export const ACCESS_DAYS = 7;

export function billingEnabled() {
  return process.env.WTP_PAYWALL_ENABLED === "true";
}

export function hashAccessToken(token: string) {
  return createHash("sha256").update(`sugar-scanner-access:${token}`).digest("hex");
}

export function hashRestoreToken(token: string) {
  return createHash("sha256").update(`sugar-scanner-restore:${token}`).digest("hex");
}

export function makeRestoreToken() {
  return randomBytes(32).toString("base64url");
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key ? new Stripe(key) : null;
}

export function checkoutOrigin(request: Request) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return new URL(configured).origin;
  const host = request.headers.get("x-forwarded-host")?.trim() || request.headers.get("host")?.trim();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(request.url).protocol.replace(":", "");
  return host ? `${protocol}://${host}` : new URL(request.url).origin;
}

export async function activateCheckout(session: Stripe.Checkout.Session, accessTokenHash: string) {
  if (session.payment_status !== "paid") return null;
  if (session.metadata?.offer_version !== WTP_OFFER_VERSION) return null;
  if (session.metadata?.access_token_hash !== accessTokenHash) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("billing_storage_unavailable");
  const paidAt = session.created ? new Date(session.created * 1_000) : new Date();
  const expiresAt = new Date(paidAt.getTime() + ACCESS_DAYS * 24 * 60 * 60 * 1_000).toISOString();
  const email = session.customer_details?.email?.trim().toLowerCase() || session.customer_email?.trim().toLowerCase() || null;
  const { data: entitlement, error } = await supabase
    .from("scanner_entitlements")
    .upsert({
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      email,
      status: "active",
      starts_at: paidAt.toISOString(),
      expires_at: expiresAt,
      updated_at: new Date().toISOString()
    }, { onConflict: "stripe_checkout_session_id" })
    .select("id, expires_at")
    .single();
  if (error || !entitlement) throw new Error("billing_storage_failed");
  const { error: tokenError } = await supabase.from("scanner_access_tokens").upsert({
    token_hash: accessTokenHash,
    entitlement_id: entitlement.id
  }, { onConflict: "token_hash" });
  if (tokenError) throw new Error("billing_token_storage_failed");
  return { expiresAt: entitlement.expires_at as string };
}

export async function readAccessStatus(accessTokenHash: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("scanner_access_tokens")
    .select("scanner_entitlements!inner(status,expires_at)")
    .eq("token_hash", accessTokenHash)
    .maybeSingle();
  if (error || !data) return null;
  const entitlement = Array.isArray(data.scanner_entitlements)
    ? data.scanner_entitlements[0]
    : data.scanner_entitlements;
  if (!entitlement || entitlement.status !== "active") return null;
  const expiresAt = entitlement.expires_at as string;
  const active = new Date(expiresAt).getTime() > Date.now();
  return { active, expired: !active, expiresAt };
}

export async function readActiveAccess(accessTokenHash: string) {
  const access = await readAccessStatus(accessTokenHash);
  return access?.active ? { expiresAt: access.expiresAt } : null;
}
