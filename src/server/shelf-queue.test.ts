import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), eq: vi.fn(), research: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabaseAdmin: () => ({ rpc: m.rpc, from: () => ({ update: m.update }) }) }));
vi.mock("./shelf-research", () => ({ researchShelfProduct: m.research, assessResearchResult: vi.fn() }));
import { enqueueShelf, ownerHash, runShelfQueueOnce, shelfJobKey } from "./shelf-queue";
const lookup = { brand: "QA", name: "Chips", variant: "", packSize: "100 g" };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SHELF_RESEARCH_QUEUE_ENABLED", "true"); m.eq.mockReturnValue({ eq: m.eq, then: (resolve: (value: unknown) => void) => resolve({ error: null }) }); m.update.mockReturnValue({ eq: m.eq }); m.research.mockResolvedValue({ status: "needs_info", reason: "Missing", missing: [], result: null }); });
describe("durable queue worker", () => {
  it("deduplicates identities but separates variants and sources", () => { expect(shelfJobKey(lookup)).toBe(shelfJobKey({ ...lookup, brand: "qa" })); expect(shelfJobKey(lookup)).not.toBe(shelfJobKey({ ...lookup, variant: "light" })); expect(ownerHash("a")).not.toBe(ownerHash("b")); });
  it("does not write the raw browser token", async () => { m.rpc.mockResolvedValue({ error: null }); await enqueueShelf("secret", [lookup]); expect(m.rpc.mock.calls[0][1].p_owner).toBe(ownerHash("secret")); });
  it("finishes only the lease it claimed", async () => { m.rpc.mockResolvedValue({ data: [{ id: "job", lookup, attempts: 1, lease_token: "lease" }], error: null }); await runShelfQueueOnce(); expect(m.eq).toHaveBeenCalledWith("lease_token", "lease"); expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ status: "needs_info", lease_until: null })); });
  it("retries transient failures and caps attempts", async () => { m.research.mockRejectedValue(new Error("offline")); m.rpc.mockResolvedValue({ data: [{ id: "job", lookup, attempts: 1, lease_token: "lease" }] }); await runShelfQueueOnce(); expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ status: "retry" })); m.rpc.mockResolvedValue({ data: [{ id: "job", lookup, attempts: 3, lease_token: "lease2" }] }); await runShelfQueueOnce(); expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed" })); });
});
