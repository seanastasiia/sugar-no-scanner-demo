import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ScoredProduct } from "@/lib/types";
import { listProducts } from "@/server/catalog-repository";
import { recognizeProducts } from "@/server/recognition";
import { createRecognitionRateLimiter, recognitionClientKey, type RateLimiter } from "@/server/rate-limit";
import { readBoundedJson } from "@/server/request-body";

export const runtime = "nodejs";

const requestSchema = z
  .object({
    imageDataUrl: z.string().max(2_800_000).optional(),
    source: z.enum(["camera", "upload", "sample-shelf", "sample-conveyor"]),
    focusMode: z.boolean().optional(),
    sampleFrame: z.number().int().nonnegative().max(10_000).optional()
  })
  .refine((value) => value.source.startsWith("sample-") || Boolean(value.imageDataUrl), {
    message: "An image is required for camera or upload recognition."
  });

const MAX_REQUEST_BYTES = 3_000_000;
const liveRecognitionRateLimiter = createRecognitionRateLimiter();

interface RecognizeRouteDependencies {
  listProducts: () => Promise<ScoredProduct[]>;
  recognize: typeof recognizeProducts;
  limiter: RateLimiter;
  requestId: () => string;
}

export function createRecognizePost(overrides: Partial<RecognizeRouteDependencies> = {}) {
  const dependencies: RecognizeRouteDependencies = {
    listProducts,
    recognize: recognizeProducts,
    limiter: liveRecognitionRateLimiter,
    requestId: randomUUID,
    ...overrides
  };
  return async function post(request: Request) {
    let body: unknown;
    try {
      body = await readBoundedJson(request, MAX_REQUEST_BYTES);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.message === "body_too_large" ? "request_too_large" : "invalid_request"
        },
        { status: error instanceof Error && error.message === "body_too_large" ? 413 : 400 }
      );
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
    }
    if (!parsed.data.source.startsWith("sample-")) {
      const decision = dependencies.limiter.consume(recognitionClientKey(request));
      if (!decision.allowed) {
        return NextResponse.json(
          { error: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds },
          {
            status: 429,
            headers: { "retry-after": String(decision.retryAfterSeconds), "cache-control": "no-store" }
          }
        );
      }
    }
    const requestId = dependencies.requestId();
    try {
      const catalog = await dependencies.listProducts();
      const result = await dependencies.recognize({ ...parsed.data, catalog, requestId });
      return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "recognition_failed",
          requestId,
          error: error instanceof Error ? error.message : "unknown"
        })
      );
      return NextResponse.json(
        { error: "recognition_failed", requestId, imageStored: false },
        { status: 502 }
      );
    }
  };
}

export const POST = createRecognizePost();
