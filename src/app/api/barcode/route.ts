import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveBarcodeFromKnownCatalogs } from "@/server/barcode-resolution";
import { listProducts } from "@/server/catalog-repository";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";

export const runtime = "nodejs";

const requestSchema = z.object({ barcode: z.string().regex(/^\d{8,14}$/) }).strict();
const limiter = createRecognitionRateLimiter();

export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) {
    return NextResponse.json({ error: "untrusted_origin" }, { status: 403 });
  }
  const decision = limiter.consume(recognitionClientKey(request));
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds },
      { status: 429, headers: { "retry-after": String(decision.retryAfterSeconds) } }
    );
  }
  let body: unknown;
  try {
    body = await readBoundedJson(request, 2_000);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const result = resolveBarcodeFromKnownCatalogs(parsed.data.barcode, await listProducts());
  return NextResponse.json(
    result ? { status: "matched", ...result, imageStored: false } : { status: "not_found", imageStored: false },
    { headers: { "cache-control": "private, max-age=300" } }
  );
}
