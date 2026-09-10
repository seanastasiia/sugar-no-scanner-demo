import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ enqueue: vi.fn(), list: vi.fn(), retry: vi.fn(), run: vi.fn() }));
vi.mock("@/server/shelf-queue", () => ({ enqueueShelf: m.enqueue, listShelfQueue: m.list, retryShelf: m.retry, runShelfQueueOnce: m.run, shelfQueueEnabled: () => process.env.SHELF_RESEARCH_QUEUE_ENABLED === "true" }));
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: vi.fn() }));
import { POST } from "./route";
const key = "a".repeat(64);
const req = (body: unknown, owner = key, origin = "http://localhost") => new Request("http://localhost/api/pilot/shelf-queue", { method: "POST", headers: { origin, "x-shelf-queue-key": owner }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SHELF_RESEARCH_QUEUE_ENABLED", "true"); m.list.mockResolvedValue([]); m.enqueue.mockResolvedValue(undefined); m.retry.mockResolvedValue(false); });
afterEach(() => vi.unstubAllEnvs());
describe("private pilot queue API", () => {
  it("is absent when the pilot flag is off", async () => { vi.stubEnv("SHELF_RESEARCH_QUEUE_ENABLED", "false"); expect((await POST(req({ action: "list" }))).status).toBe(404); expect(m.list).not.toHaveBeenCalled(); });
  it("requires the owner capability and same origin", async () => { expect((await POST(req({ action: "list" }, ""))).status).toBe(400); expect((await POST(req({ action: "list" }, key, "https://evil.example"))).status).toBe(403); expect(m.list).not.toHaveBeenCalled(); });
  it.each([{ action: "enqueue", items: [], image: "data" }, { action: "enqueue", items: [{ brand: "QA", name: "Chips", image: "data" }] }, { action: "enqueue", items: [{ brand: "QA", name: "Chips", sourceUrl: "http://localhost/private" }] }])("rejects images and unsafe sources before a write", async body => { expect((await POST(req(body))).status).toBe(400); expect(m.enqueue).not.toHaveBeenCalled(); });
  it("scopes reads and writes to the supplied owner", async () => { const r = await POST(req({ action: "enqueue", items: [{ brand: "QA", name: "Chips" }] })); expect(r.status).toBe(200); expect(m.enqueue).toHaveBeenCalledWith(key, [{ brand: "QA", name: "Chips", variant: "", packSize: "" }]); expect(m.list).toHaveBeenCalledWith(key); expect(r.headers.get("cache-control")).toBe("no-store"); });
  it("does not claim success when the database is unavailable", async () => { m.enqueue.mockRejectedValue(new Error("queue_unavailable")); expect((await POST(req({ action: "enqueue", items: [{ barcode: "4006381333931" }] }))).status).toBe(503); });
  it("enforces retry cooldown or missing ownership", async () => { expect((await POST(req({ action: "retry", id: "b".repeat(64) }))).status).toBe(409); });
});
