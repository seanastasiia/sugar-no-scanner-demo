import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_SCAN_PRODUCTS } from "@/lib/scan-limits";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";
import { getKnownRetailerOfferByKey } from "@/server/retailer-offers";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";

const requestSchema = z.object({
  keys: z
    .array(
      z
        .string()
        .min(1)
        .max(220)
        .regex(/^(?:barbora:[a-z0-9-]+|(?:rimi_lv|livin_lv):[A-Za-z0-9._~-]+)$/)
    )
    .min(1)
    .max(MAX_SCAN_PRODUCTS * 3)
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

  const keys = [...new Set(parsed.data.keys)];
  const resolved = await Promise.all(
    keys.map(async (key) => [key, await getKnownRetailerOfferByKey(key).catch(() => null)] as const)
  );

  return NextResponse.json(
    { offers: Object.fromEntries(resolved) },
    { headers: { "cache-control": "private, max-age=300" } }
  );
}
