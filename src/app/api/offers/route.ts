import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_SCAN_PRODUCTS } from "@/lib/scan-limits";
import { getKnownBarboraOfferBySlug } from "@/server/barbora-catalog";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";

const requestSchema = z.object({
  slugs: z.array(z.string().min(1).max(180).regex(/^[a-z0-9-]+$/)).min(1).max(MAX_SCAN_PRODUCTS)
});
const offersRateLimiter = createRecognitionRateLimiter();

export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) {
    return NextResponse.json(
      { error: "untrusted_origin" },
      { status: 403, headers: { "cache-control": "no-store" } }
    );
  }
  const parsed = requestSchema.safeParse(await readBoundedJson(request, 8_000).catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_offer_request" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }
  const decision = offersRateLimiter.consume(recognitionClientKey(request));
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds },
      {
        status: 429,
        headers: { "retry-after": String(decision.retryAfterSeconds), "cache-control": "no-store" }
      }
    );
  }

  const slugs = [...new Set(parsed.data.slugs)];
  const resolved = await Promise.all(
    slugs.map(async (slug) => [slug, await getKnownBarboraOfferBySlug(slug).catch(() => null)] as const)
  );

  return NextResponse.json(
    { offers: Object.fromEntries(resolved) },
    { headers: { "cache-control": "private, max-age=300" } }
  );
}
