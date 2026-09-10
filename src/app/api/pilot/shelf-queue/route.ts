import { after, NextResponse } from "next/server";
import { z } from "zod";
import { queueLookupSchema } from "@/lib/shelf-queue";
import { enqueueShelf, retryShelf, listShelfQueue, runShelfQueueOnce, shelfQueueEnabled } from "@/server/shelf-queue";
import { approvedWebProductUrl, validWebGtin } from "@/server/web-product-evidence";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
import { FixedWindowRateLimiter, recognitionClientKey } from "@/server/rate-limit";

export const runtime = "nodejs";
const limiter = new FixedWindowRateLimiter(60, 60000);
const inputSchema = z.object({ action: z.enum(["list", "enqueue", "retry"]), items: z.array(queueLookupSchema).max(10).optional(), id: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict();
const headers = { "cache-control": "no-store" };
export async function POST(request: Request) {
  if (!shelfQueueEnabled()) return NextResponse.json({ error: "pilot_disabled" }, { status: 404, headers });
  if (!hasTrustedBrowserOrigin(request)) return NextResponse.json({ error: "untrusted_origin" }, { status: 403, headers });
  const owner = request.headers.get("x-shelf-queue-key") || "";
  if (!/^[a-f0-9]{64}$/.test(owner)) return NextResponse.json({ error: "invalid_queue_key" }, { status: 400, headers });
  if (!limiter.consume(recognitionClientKey(request)).allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers });
  const parsed = inputSchema.safeParse(await readBoundedJson(request, 24000).catch(() => null));
  if (!parsed.success || parsed.data.items?.some(item => (item.barcode && !validWebGtin(item.barcode)) || (item.sourceUrl && !approvedWebProductUrl(item.sourceUrl)))) return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  try {
    if (parsed.data.action === "retry") {
      if (!parsed.data.id || !await retryShelf(owner, parsed.data.id)) return NextResponse.json({ error: "retry_later" }, { status: 409, headers });
      after(runShelfQueueOnce);
    }
    if (parsed.data.action === "enqueue") {
      if (!parsed.data.items?.length) return NextResponse.json({ error: "no_items" }, { status: 400, headers });
      await enqueueShelf(owner, parsed.data.items);
      after(runShelfQueueOnce);
    }
    return NextResponse.json({ items: await listShelfQueue(owner) }, { headers });
  } catch (error) {
    const limited = error instanceof Error && error.message === "queue_limit";
    return NextResponse.json({ error: limited ? "queue_limit" : "queue_unavailable" }, { status: limited ? 429 : 503, headers });
  }
}
