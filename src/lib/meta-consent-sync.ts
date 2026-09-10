import { WTP_ACCESS_TOKEN_KEY } from "@/lib/wtp-access";
const PENDING_KEY = "sugar-meta-revoke-pending-v1";
export async function syncMetaWithdrawal(denied = false) {
  try {
    if (denied) localStorage.setItem(PENDING_KEY, "1");
    if (!localStorage.getItem(PENDING_KEY)) return;
    const accessToken = localStorage.getItem(WTP_ACCESS_TOKEN_KEY);
    if (!accessToken) { localStorage.removeItem(PENDING_KEY); return; }
    const response = await fetch("/api/meta/consent", {
      method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
      body: JSON.stringify({ accessToken, consent: false })
    });
    if (response.ok) localStorage.removeItem(PENDING_KEY);
  } catch { /* Keep the retry marker. Browser tracking is already revoked. */ }
}
