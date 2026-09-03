import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_SCAN_PRODUCTS } from "@/lib/scan-limits";
import { loadShelfEvidence } from "@/server/personal-shelf-evidence";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";

const schema = z.object({ ids: z.array(z.string().max(240).regex(/^(?:barbora:[a-z0-9-]+|livinn_lt:[A-Za-z0-9._~-]+|off:\d{8,14})$/)).min(1).max(MAX_SCAN_PRODUCTS) }).strict();
const limiter = createRecognitionRateLimiter();
const headers = { "cache-control": "no-store" };

export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) return NextResponse.json({ error: "untrusted_origin" }, { status: 403, headers });
  const input = schema.safeParse(await readBoundedJson(request, 4_000).catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_shelf_request" }, { status: 400, headers });
  const decision = limiter.consume(recognitionClientKey(request));
  if (!decision.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { ...headers, "retry-after": String(decision.retryAfterSeconds) } });
  return NextResponse.json({ evidence: await loadShelfEvidence([...new Set(input.data.ids)]) }, { headers });
}
