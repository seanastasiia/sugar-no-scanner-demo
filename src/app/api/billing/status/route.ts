import { NextResponse } from "next/server";
import { z } from "zod";
import { activateCheckout, billingEnabled, getStripe, hashAccessToken, readAccessStatus } from "@/server/billing";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";

const limiter = createRecognitionRateLimiter({ BILLING_STATUS_RATE_LIMIT: "60" });

const schema = z.object({ accessToken: z.uuid(), sessionId: z.string().max(180).optional() });

export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) return NextResponse.json({ error: "untrusted_origin" }, { status: 403 });
  const decision = limiter.consume(recognitionClientKey(request));
  if (!decision.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!billingEnabled()) return NextResponse.json({ active: false, enabled: false });
  const parsed = schema.safeParse(await readBoundedJson(request, 4_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_access" }, { status: 400 });
  const accessTokenHash = hashAccessToken(parsed.data.accessToken);
  try {
    if (parsed.data.sessionId) {
      const stripe = getStripe();
      if (!stripe) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
      const session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId);
      const activated = await activateCheckout(session, accessTokenHash);
      if (activated) return NextResponse.json({
        active: true,
        ...activated,
        scanSource: session.metadata?.scan_source === "upload" ? "upload" : "camera"
      });
    }
    const access = await readAccessStatus(accessTokenHash);
    return NextResponse.json(access || { active: false, expired: false }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "access_check_failed" }, { status: 503 });
  }
}
