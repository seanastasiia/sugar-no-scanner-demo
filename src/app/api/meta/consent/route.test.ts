import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ revokeMetaConsent: vi.fn(), hashAccessToken: vi.fn(() => "a".repeat(64)) }));
vi.mock("@/server/billing", () => ({ hashAccessToken: mocks.hashAccessToken }));
vi.mock("@/server/meta-capi", () => ({ revokeMetaConsent: mocks.revokeMetaConsent }));
import { POST } from "./route";
const accessToken = "11111111-1111-4111-8111-111111111111";
const request = (consent: boolean, origin = "https://scanner.test") => new Request("https://scanner.test/api/meta/consent", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ accessToken, consent })
});
beforeEach(() => { vi.clearAllMocks(); mocks.revokeMetaConsent.mockResolvedValue(undefined); });
it("rejects cross-origin attempts without changing stored consent", async () => {
  expect((await POST(request(false, "https://attacker.test"))).status).toBe(403);
  expect(mocks.revokeMetaConsent).not.toHaveBeenCalled();
});
it("does not permit this endpoint to grant consent", async () => {
  expect((await POST(request(true))).status).toBe(400); expect(mocks.revokeMetaConsent).not.toHaveBeenCalled();
});
it("revokes using a hash, without changing a paid entitlement", async () => {
  expect((await POST(request(false))).status).toBe(200);
  expect(mocks.revokeMetaConsent).toHaveBeenCalledWith("a".repeat(64));
});
it("returns a failure so the browser retains its retry marker", async () => {
  mocks.revokeMetaConsent.mockRejectedValue(new Error("offline"));
  expect((await POST(request(false))).status).toBe(503);
});
