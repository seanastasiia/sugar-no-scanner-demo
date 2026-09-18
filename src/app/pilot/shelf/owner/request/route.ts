import { NextResponse } from "next/server";
import { z } from "zod";
import { createOwnerToken, ownerEmailMatches } from "@/server/shelf-owner";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
import { readBoundedJson } from "@/server/request-body";
import { FixedWindowRateLimiter, recognitionClientKey } from "@/server/rate-limit";
const limiter = new FixedWindowRateLimiter(5, 15 * 60 * 1000);
const mailboxLimiter = new FixedWindowRateLimiter(3, 15 * 60 * 1000);
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) return json({ error: "untrusted_origin" }, 403);
  if (!limiter.consume(recognitionClientKey(request)).allowed) return json({ error: "rate_limited" }, 429);
  const parsed = z.object({ email: z.email().max(254) }).safeParse(await readBoundedJson(request, 2000).catch(() => null));
  if (!parsed.success) return json({ error: "invalid_email" }, 400);
  // Never reveal the configured address or send mail to an arbitrary recipient.
  if (!ownerEmailMatches(parsed.data.email)) return json({ ok: true });
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.BILLING_EMAIL_FROM?.trim() || process.env.FEEDBACK_EMAIL_FROM?.trim();
  const origin = process.env.APP_BASE_URL?.trim();
  const token = createOwnerToken("link");
  if (!key || !from || !origin || !token) return json({ error: "unavailable" }, 503);
  if (!mailboxLimiter.consume("owner").allowed) return json({ ok: true });
  const url = `${new URL(origin).origin}/pilot/shelf/owner#token=${token}`;
  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [parsed.data.email.trim().toLowerCase()], subject: "Your Personal Shelf access", text: `Open this link in the browser you use for Personal Shelf within 15 minutes:\n\n${url}\n\nThis enables your private free access on Personal Shelf only. The public scanner remains unchanged. Do not forward this link. If you did not request it, ignore this email.` }),
      signal: AbortSignal.timeout(5000)
    });
    return result.ok ? json({ ok: true }) : json({ error: "email_failed" }, 503);
  } catch { return json({ error: "email_failed" }, 503); }
}
