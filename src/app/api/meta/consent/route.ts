import { z } from "zod";
import { hashAccessToken } from "@/server/billing";
import { revokeMetaConsent } from "@/server/meta-capi";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";
const limiter = createRecognitionRateLimiter({ META_CONSENT_RATE_LIMIT: "60" });
const schema = z.object({ accessToken: z.uuid(), consent: z.literal(false) });
export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) return Response.json({ error: "untrusted_origin" }, { status: 403 });
  if (!limiter.consume(recognitionClientKey(request)).allowed) return Response.json({ error: "rate_limited" }, { status: 429 });
  const parsed = schema.safeParse(await readBoundedJson(request, 2_000).catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_consent" }, { status: 400 });
  try {
    await revokeMetaConsent(hashAccessToken(parsed.data.accessToken));
    return Response.json({ saved: true }, { headers: { "cache-control": "no-store" } });
  } catch { return Response.json({ error: "consent_retry_needed" }, { status: 503 }); }
}
