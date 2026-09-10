import { createHash } from "node:crypto";
import { queueLookupSchema, type QueueLookup, type ShelfQueueItem } from "@/lib/shelf-queue";
import { getSupabaseAdmin } from "./supabase";
import { assessResearchResult, researchShelfProduct } from "./shelf-research";

export const shelfQueueEnabled = () => process.env.SHELF_RESEARCH_QUEUE_ENABLED === "true";
export const ownerHash = (token: string) => createHash("sha256").update(`shelf-owner:${token}`).digest("hex");
export function shelfJobKey(input: QueueLookup): string {
  // Explicit fields avoid aliasing different recipes, units, or user-supplied sources.
  return createHash("sha256").update(JSON.stringify([input.productId || "", input.barcode || "", input.brand, input.name, input.variant, input.packSize, input.sourceUrl || ""].map(s => s.normalize("NFKC").trim().toLowerCase()))).digest("hex");
}
export async function enqueueShelf(owner: string, lookups: QueueLookup[]) {
  const db = getSupabaseAdmin(); if (!db) throw new Error("queue_unavailable");
  for (const lookup of lookups) {
    const { error } = await db.rpc("enqueue_shelf_research", { p_owner: ownerHash(owner), p_id: shelfJobKey(lookup), p_lookup: lookup });
    if (error) throw new Error(error.message.includes("queue_limit") ? "queue_limit" : "queue_unavailable");
  }
}
export async function listShelfQueue(owner: string): Promise<ShelfQueueItem[]> {
  const db = getSupabaseAdmin(); if (!db) throw new Error("queue_unavailable");
  const { data, error } = await db.from("shelf_research_receipts").select("shelf_research_jobs(id,lookup,status,reason,missing,result,updated_at)").eq("owner_hash", ownerHash(owner)).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("queue_unavailable");
  return (data || []).flatMap(receipt => {
    const job = receipt.shelf_research_jobs as unknown as { id: string; lookup: QueueLookup; status: ShelfQueueItem["status"]; reason: string; missing: string[]; result: ShelfQueueItem["result"]; updated_at: string };
    if (!job || !queueLookupSchema.safeParse(job.lookup).success) return [];
    // A newer model must not expose an old ready record as rated without rechecking it.
    const rated = job.result ? assessResearchResult(job.result) : null;
    return [{ id: job.id, lookup: job.lookup, status: job.status === "ready" && rated?.status !== "ready" ? "review" as const : job.status,
      reason: job.status === "ready" && rated?.status !== "ready" ? "The current model needs this product reviewed again." : job.reason,
      missing: job.missing, result: rated?.status === "ready" ? job.result : null, updatedAt: job.updated_at }];
  });
}
export async function retryShelf(owner: string, id: string) {
  const db = getSupabaseAdmin(); if (!db) throw new Error("queue_unavailable");
  const { data, error } = await db.rpc("retry_shelf_research", { p_owner: ownerHash(owner), p_id: id });
  if (error) throw new Error("queue_unavailable");
  return Boolean(data);
}
let running = false;
export async function runShelfQueueOnce() {
  if (!shelfQueueEnabled() || running) return;
  const db = getSupabaseAdmin(); if (!db) return;
  running = true;
  try {
    const { data, error } = await db.rpc("claim_shelf_research");
    if (error) throw new Error("queue_claim_failed");
    const job = data?.[0]; if (!job) return;
    let outcome;
    try {
      const input = queueLookupSchema.parse(job.lookup);
      outcome = job.attempts > 3 ? { status: "failed", reason: "Research could not finish after three attempts. Please try again later.", missing: [], result: null } : await researchShelfProduct(input);
    } catch {
      outcome = { status: job.attempts >= 3 ? "failed" : "retry", reason: job.attempts >= 3 ? "Research is temporarily unavailable. Your product is saved." : "A source is temporarily unavailable. We will retry automatically.", missing: [], result: null };
    }
    const { error: updateError } = await db.from("shelf_research_jobs").update({ ...outcome, lease_until: null, lease_token: null,
      available_at: new Date(Date.now() + job.attempts * 60000).toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id).eq("lease_token", job.lease_token);
    if (updateError) throw new Error("queue_update_failed");
  } catch { console.error(JSON.stringify({ event: "shelf_queue_worker_unavailable" })); }
  finally { running = false; }
}
let timer: ReturnType<typeof setInterval> | undefined;
export function startShelfQueueWorker() {
  if (!shelfQueueEnabled() || timer) return;
  timer = setInterval(() => { void runShelfQueueOnce(); }, 15000);
  timer.unref();
}
