import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const publicPaths = new Set(["/access", "/api/auth", "/api/health", "/offline.html"]);

function expectedToken(): string {
  const code = process.env.DEMO_ACCESS_CODE?.trim();
  const secret = process.env.DEMO_SESSION_SECRET?.trim();
  if (!code || !secret) return "";
  return createHash("sha256").update(`sugar-scanner:${code}:${secret}`).digest("hex");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (publicPaths.has(pathname)) return NextResponse.next();

  const expected = expectedToken();
  if (!expected && process.env.NODE_ENV !== "production") return NextResponse.next();

  const authorized = Boolean(expected) && request.cookies.get("sugar_scanner_access")?.value === expected;
  if (authorized) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const accessUrl = new URL("/access", request.url);
  accessUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|apple-touch-icon.png|manifest.webmanifest|sw.js).*)"
  ]
};
