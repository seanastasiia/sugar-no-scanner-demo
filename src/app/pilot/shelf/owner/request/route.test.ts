import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
const fetchMock = vi.fn();
beforeEach(() => { vi.stubEnv("SHELF_RESEARCH_QUEUE_ENABLED", "true"); vi.stubEnv("SHELF_OWNER_EMAIL", "owner@example.com"); vi.stubEnv("SHELF_OWNER_SECRET", "a".repeat(64)); vi.stubEnv("RESEND_API_KEY", "test"); vi.stubEnv("BILLING_EMAIL_FROM", "noreply@example.com"); vi.stubEnv("APP_BASE_URL", "https://scanner.example"); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset().mockResolvedValue(new Response('{}')); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const req = (email: string, origin = "http://localhost") => new Request("http://localhost/pilot/shelf/owner/request", { method: "POST", headers: { origin, "x-forwarded-for": email }, body: JSON.stringify({ email }) });
it("sends only to the owner and keeps proof out of server URL logs", async () => {
  expect((await POST(req("owner@example.com"))).status).toBe(200);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body); expect(body.to).toEqual(["owner@example.com"]); expect(body.text).toContain("https://scanner.example/pilot/shelf/owner#token=");
});
it("does not disclose identity or email an arbitrary address", async () => { const r = await POST(req("stranger@example.com")); expect(await r.json()).toEqual({ ok: true }); expect(fetchMock).not.toHaveBeenCalled(); });
it("rejects cross origin", async () => { expect((await POST(req("owner@example.com", "https://evil.example"))).status).toBe(403); expect(fetchMock).not.toHaveBeenCalled(); });
it("reports delivery failure", async () => { fetchMock.mockResolvedValue(new Response('{}', { status: 503 })); expect((await POST(req("owner@example.com"))).status).toBe(503); });
