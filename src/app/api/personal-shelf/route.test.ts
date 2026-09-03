import { beforeEach, describe, expect, it, vi } from "vitest";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/server/personal-shelf-evidence", () => ({ loadShelfEvidence: load }));
import { POST } from "./route";

const request = (body: unknown, origin = "http://localhost") => new Request("http://localhost/api/personal-shelf", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
beforeEach(() => load.mockReset().mockResolvedValue({}));
describe("opt-in shelf evidence endpoint", () => {
  it("rejects cross-origin reads before storage access", async () => {
    expect((await POST(request({ ids: ["barbora:qa"] }, "https://evil.example"))).status).toBe(403);
    expect(load).not.toHaveBeenCalled();
  });
  it.each([{ ids: [] }, { ids: ["https://evil.example"] }, { ids: Array(11).fill("barbora:qa") }, { ids: ["barbora:qa"], image: "no image uploads" }])("bounds and validates requests", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });
  it("deduplicates IDs and returns evidence without logging or persisting scan metadata", async () => {
    const response = await POST(request({ ids: ["barbora:qa", "barbora:qa"] }));
    expect(response.status).toBe(200);
    expect(load).toHaveBeenCalledWith(["barbora:qa"]);
    expect(await response.json()).toEqual({ evidence: {} });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rate limits repeated lookups", async () => {
    let status = 0;
    for (let n = 0; n < 40; n++) status = (await POST(request({ ids: ["barbora:qa"] }))).status;
    expect(status).toBe(429);
  });
});
