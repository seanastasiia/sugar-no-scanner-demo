import { NextResponse } from "next/server";
import { z } from "zod";
import type { ScoredProduct } from "@/lib/types";
import { MAX_SCAN_PRODUCTS } from "@/lib/scan-limits";
import { listProducts } from "@/server/catalog-repository";
import {
  resolveVisibleDetections,
  type ConfirmedProviderDetection,
  type DetectionResolutionDependencies
} from "@/server/recognition";
import { createRecognitionRateLimiter, recognitionClientKey, type RateLimiter } from "@/server/rate-limit";
import { readBoundedJson } from "@/server/request-body";

export const runtime = "nodejs";

const identitySchema = z.object({
  brand: z.string().max(80),
  name: z.string().max(180),
  variant: z.string().max(120).nullable(),
  packSize: z.string().max(60).nullable(),
  category: z.string().max(120).nullable(),
  matchKind: z.enum(["verified_catalog", "barbora", "retailer_catalog", "open_food_facts", "web_search", "visual_only"]),
  searchQuery: z.string().max(240).optional(),
  barcode: z.string().max(14).nullable().optional()
});

const detectionSchema = z.object({
  productId: z.string().min(1).max(320),
  catalogProductId: z.string().max(240).nullable().optional(),
  confidence: z.number().min(0).max(1),
  box: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1)
  }),
  observedText: z.string().max(240),
  identity: identitySchema,
  shelfPrice: z
    .object({
      amount: z.number().min(0).max(10_000),
      currency: z.literal("EUR"),
      observedText: z.string().max(60),
      confidence: z.number().min(0).max(1)
    })
    .nullable()
    .optional()
});

const requestSchema = z.object({ detections: z.array(detectionSchema).min(1).max(MAX_SCAN_PRODUCTS) }).strict();
const MAX_REQUEST_BYTES = 64_000;
const liveResolutionRateLimiter = createRecognitionRateLimiter();

interface ResolveRouteDependencies {
  listProducts: () => Promise<ScoredProduct[]>;
  resolve: (
    detections: ConfirmedProviderDetection[],
    catalog: ScoredProduct[],
    dependencies?: DetectionResolutionDependencies,
    concurrency?: number,
    mode?: "fast" | "complete"
  ) => ReturnType<typeof resolveVisibleDetections>;
  limiter: RateLimiter;
}

function toProviderDetection(detection: z.infer<typeof detectionSchema>): ConfirmedProviderDetection {
  const identity = detection.identity;
  const productName = [
    identity.name,
    ...[identity.variant, identity.packSize].filter(
      (part): part is string => Boolean(part && !identity.name.toLowerCase().includes(part.toLowerCase()))
    )
  ].join(" ");
  const retailCategory =
    identity.category === "Packaged snacks"
      ? "snack"
      : identity.category === "Dairy desserts"
        ? "dairy_dessert"
        : "other";
  return {
    brand: identity.brand,
    productName,
    searchQuery:
      identity.searchQuery || [identity.brand, identity.name, identity.variant, identity.packSize].filter(Boolean).join(" "),
    barcode: identity.barcode || "",
    retailCategory,
    confidence: detection.confidence,
    box: detection.box,
    shelfPriceCents: detection.shelfPrice ? Math.round(detection.shelfPrice.amount * 100) : 0,
    shelfPriceText: detection.shelfPrice?.observedText || "",
    shelfPriceConfidence: detection.shelfPrice?.confidence || 0,
    shelfPriceLabelVisible: Boolean(detection.shelfPrice),
    confirmedBarboraSlug: detection.productId.startsWith("barbora:")
      ? detection.productId.slice("barbora:".length)
      : undefined
  };
}

export function createResolveProductsPost(overrides: Partial<ResolveRouteDependencies> = {}) {
  const dependencies: ResolveRouteDependencies = {
    listProducts,
    resolve: resolveVisibleDetections,
    limiter: liveResolutionRateLimiter,
    ...overrides
  };
  return async function post(request: Request) {
    let body: unknown;
    try {
      body = await readBoundedJson(request, MAX_REQUEST_BYTES);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error && error.message === "body_too_large" ? "request_too_large" : "invalid_request" },
        { status: error instanceof Error && error.message === "body_too_large" ? 413 : 400 }
      );
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const decision = dependencies.limiter.consume(recognitionClientKey(request));
    if (!decision.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds },
        { status: 429, headers: { "retry-after": String(decision.retryAfterSeconds), "cache-control": "no-store" } }
      );
    }

    const startedAt = performance.now();
    try {
      const catalog = await dependencies.listProducts();
      const detections = await dependencies.resolve(
        parsed.data.detections.map(toProviderDetection),
        catalog,
        undefined,
        3,
        "complete"
      );
      return NextResponse.json(
        { detections, latencyMs: Math.round(performance.now() - startedAt), imageStored: false },
        { headers: { "cache-control": "no-store" } }
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "recognition_enrichment_failed",
          error: error instanceof Error ? error.message : "unknown"
        })
      );
      return NextResponse.json({ error: "resolution_failed", imageStored: false }, { status: 502 });
    }
  };
}

export const POST = createResolveProductsPost();
