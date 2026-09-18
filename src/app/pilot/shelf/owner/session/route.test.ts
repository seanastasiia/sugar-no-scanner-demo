import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createOwnerToken } from "@/server/shelf-owner";
import { POST } from "./route";
beforeEach(() => { vi.stubEnv("SHELF_RESEARCH_QUEUE_ENABLED", "true"); vi.stubEnv("SHELF_OWNER_EMAIL", "owner@example.com"); vi.stubEnv("SHELF_OWNER_SECRET", "a".repeat(64)); });
afterEach(() => vi.unstubAllEnvs());
const req = (token: string, origin = "http://localhost") => new Request("http://localhost/pilot/shelf/owner/session", { method: "POST", headers: { origin }, body: JSON.stringify({ token }) });
it("sets a private path-scoped cookie only after valid email proof", async () => {
  const r = await POST(req(createOwnerToken("link")!)); expect(r.status).toBe(200);
  const cookie = r.headers.get("set-cookie")!; expect(cookie).toContain("Path=/pilot/shelf;"); expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("SameSite=lax");
});
it("rejects cross origin and session-token reuse as login", async () => {
  expect((await POST(req(createOwnerToken("link")!, "https://evil.example"))).status).toBe(403);
  const invalid = await POST(req(createOwnerToken("session")!)); expect(invalid.status).toBe(401); expect(invalid.headers.get("set-cookie")).toBeNull();
});
