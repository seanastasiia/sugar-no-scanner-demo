import { NextResponse } from "next/server";
import { z } from "zod";
import { WTP_OFFER_VERSION } from "@/lib/wtp-access";
import { billingEnabled, checkoutOrigin, getStripe, hashAccessToken } from "@/server/billing";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";

const limiter = createRecognitionRateLimiter({ BILLING_CHECKOUT_RATE_LIMIT: "20" });

const schema = z.object({
  accessToken: z.uuid(),
  browserSessionId: z.uuid(),
  scanSource: z.enum(["camera", "upload"]),
  attribution: z.object({
    utm_source: z.string().max(80).optional(),
    utm_medium: z.string().max(80).optional(),
    utm_campaign: z.string().max(80).optional(),
    utm_content: z.string().max(80).optional(),
    utm_term: z.string().max(80).optional()
  }).default({})
});

export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) return NextResponse.json({ error: "untrusted_origin" }, { status: 403 });
  const decision = limiter.consume(recognitionClientKey(request));
  if (!decision.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!billingEnabled()) return NextResponse.json({ error: "billing_disabled" }, { status: 404 });
  const parsed = schema.safeParse(await readBoundedJson(request, 8_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_checkout" }, { status: 400 });
  const stripe = getStripe();
  const price = process.env.STRIPE_PRICE_ID?.trim();
  if (!stripe || !price) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  const origin = checkoutOrigin(request);
  const tokenHash = hashAccessToken(parsed.data.accessToken);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: parsed.data.browserSessionId,
      customer_creation: "always",
      billing_address_collection: "auto",
      allow_promotion_codes: false,
      metadata: {
        offer_version: WTP_OFFER_VERSION,
        access_token_hash: tokenHash,
        scan_source: parsed.data.scanSource,
        ...parsed.data.attribution
      },
      success_url: `${origin}/api/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`
    });
    if (!session.url) throw new Error("checkout_url_missing");
    return NextResponse.json({ url: session.url }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }
}
