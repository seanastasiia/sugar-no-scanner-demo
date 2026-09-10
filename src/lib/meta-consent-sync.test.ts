import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { syncMetaWithdrawal } from "./meta-consent-sync";
import { WTP_ACCESS_TOKEN_KEY } from "./wtp-access";
beforeEach(() => { localStorage.clear(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it("retries withdrawal after an unavailable server and preserves access", async () => {
  const token = "11111111-1111-4111-8111-111111111111";
  localStorage.setItem(WTP_ACCESS_TOKEN_KEY, token);
  vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
  await syncMetaWithdrawal(true);
  expect(localStorage.getItem("sugar-meta-revoke-pending-v1")).toBe("1");
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ saved: true }));
  await syncMetaWithdrawal();
  expect(localStorage.getItem("sugar-meta-revoke-pending-v1")).toBeNull();
  expect(localStorage.getItem(WTP_ACCESS_TOKEN_KEY)).toBe(token);
  expect(fetch).toHaveBeenLastCalledWith("/api/meta/consent", expect.objectContaining({ body: JSON.stringify({ accessToken: token, consent: false }) }));
});
it("does not create a billing identity to record a rejected cookie choice", async () => {
  await syncMetaWithdrawal(true); expect(fetch).not.toHaveBeenCalled();
  expect(localStorage.getItem(WTP_ACCESS_TOKEN_KEY)).toBeNull();
});
