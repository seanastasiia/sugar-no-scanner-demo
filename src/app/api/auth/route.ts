import { NextResponse } from "next/server";
import { z } from "zod";
import { ACCESS_COOKIE, accessCodeMatches, sessionToken } from "@/server/auth";

const requestSchema = z.object({
  code: z.string().min(1).max(200)
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !accessCodeMatches(parsed.data.code)) {
    return NextResponse.json({ error: "The access code does not match." }, { status: 401 });
  }
  const token = sessionToken();
  if (!token && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Demo access is not configured." }, { status: 503 });
  }
  const response = NextResponse.json({ ok: true });
  if (token) {
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const secure = (forwardedProtocol || new URL(request.url).protocol.replace(":", "")) === "https";
    response.cookies.set(ACCESS_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12
    });
  }
  return response;
}
