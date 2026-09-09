import { NextResponse } from "next/server";
import { z } from "zod";
import { billingEnabled, checkoutOrigin, hashRestoreToken, makeRestoreToken } from "@/server/billing";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
import { getSupabaseAdmin } from "@/server/supabase";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";

const limiter = createRecognitionRateLimiter({ BILLING_RESTORE_RATE_LIMIT: "5" });

const schema = z.object({ email: z.email().max(254) });

export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) return NextResponse.json({ error: "untrusted_origin" }, { status: 403 });
  const decision = limiter.consume(recognitionClientKey(request));
  if (!decision.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!billingEnabled()) return NextResponse.json({ error: "billing_disabled" }, { status: 404 });
  const parsed = schema.safeParse(await readBoundedJson(request, 2_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.BILLING_EMAIL_FROM?.trim() || process.env.FEEDBACK_EMAIL_FROM?.trim();
  if (!supabase || !resendKey || !from) return NextResponse.json({ error: "restore_unavailable" }, { status: 503 });
  const email = parsed.data.email.trim().toLowerCase();
  const { data: entitlement } = await supabase.from("scanner_entitlements").select("id,expires_at")
    .eq("email", email).eq("status", "active").gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false }).limit(1).maybeSingle();
  if (entitlement) {
    const rawToken = makeRestoreToken();
    await supabase.from("scanner_restore_tokens").insert({
      token_hash: hashRestoreToken(rawToken), entitlement_id: entitlement.id,
      expires_at: new Date(Date.now() + 15 * 60 * 1_000).toISOString()
    });
    const restoreUrl = `${checkoutOrigin(request)}/?restore=${encodeURIComponent(rawToken)}`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: "Restore your Sugar.no scanner access",
        text: `Open this link within 15 minutes to restore your paid scanner access:\n\n${restoreUrl}\n\nIf you did not request this, you can ignore this email.` }),
      signal: AbortSignal.timeout(3_000)
    }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
