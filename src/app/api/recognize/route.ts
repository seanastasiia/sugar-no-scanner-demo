import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorized } from "@/server/auth";
import { listProducts } from "@/server/catalog-repository";
import { recognizeProducts } from "@/server/recognition";

export const runtime = "nodejs";

const requestSchema = z
  .object({
    imageDataUrl: z.string().max(2_800_000).optional(),
    source: z.enum(["camera", "upload", "sample-shelf", "sample-conveyor"]),
    sampleFrame: z.number().int().nonnegative().max(10_000).optional()
  })
  .refine((value) => value.source.startsWith("sample-") || Boolean(value.imageDataUrl), {
    message: "An image is required for camera or upload recognition."
  });

export async function POST(request: Request) {
  if (!(await isAuthorized())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }
  const requestId = randomUUID();
  try {
    const catalog = await listProducts();
    const result = await recognizeProducts({ ...parsed.data, catalog, requestId });
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
}
