import { NextResponse } from "next/server";
import { z } from "zod";
import { createOwnerToken, verifyOwnerToken, OWNER_COOKIE, OWNER_SESSION_SECONDS } from "@/server/shelf-owner";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
import { readBoundedJson } from "@/server/request-body";
import { FixedWindowRateLimiter, recognitionClientKey } from "@/server/rate-limit";
const limiter = new FixedWindowRateLimiter(20, 60_000);
export async function POST(request: Request) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
  if (!hasTrustedBrowserOrigin(request)) return json({ error: "untrusted_origin" }, 403);
  if (!limiter.consume(recognitionClientKey(request)).allowed) return json({ error: "rate_limited" }, 429);
  const parsed = z.object({ token: z.string().max(1000) }).safeParse(await readBoundedJson(request, 2000).catch(() => null));
  if (!parsed.success || !verifyOwnerToken(parsed.data.token, "link")) return json({ error: "invalid_or_expired" }, 401);
  const response = json({ ok: true });
  response.cookies.set(OWNER_COOKIE, createOwnerToken("session")!, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/pilot/shelf", maxAge: OWNER_SESSION_SECONDS });
  return response;
}
