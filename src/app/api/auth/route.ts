import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ACCESS_COOKIE, accessCodeMatches, sessionToken } from "@/server/auth";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";

const bodySchema = z.object({ code: z.string().min(1).max(200) });
const MAX_BODY_BYTES = 1_000;
const accessRateLimiter = createRecognitionRateLimiter({
  RECOGNITION_RATE_LIMIT: process.env.DEMO_AUTH_RATE_LIMIT || "10"
});

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" }
  });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedBrowserOrigin(request)) {
    return json({ error: "Cross-origin request rejected." }, 403);
  }
  const budget = accessRateLimiter.consume(recognitionClientKey(request));
  if (!budget.allowed) {
    return json({ error: "Too many attempts. Try again shortly." }, 429);
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "Request is too large." }, 413);
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return json({ error: "Request is too large." }, 413);
    }
    parsed = bodySchema.parse(JSON.parse(text));
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (!accessCodeMatches(parsed.code)) {
    return json({ error: "Invalid access code." }, 401);
  }
  const token = sessionToken();
  if (!token) {
    return json({ error: "Demo access is not configured." }, 503);
  }

  const response = json({ ok: true }, 200);
  response.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}
