import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "sugar_scanner_access";
const PUBLIC_PATHS = new Set(["/access", "/api/auth", "/api/health", "/offline.html"]);

function expectedToken() {
  const code = process.env.DEMO_ACCESS_CODE?.trim();
  const secret = process.env.DEMO_SESSION_SECRET?.trim();
  if (!code || !secret) return null;
  return createHash("sha256")
    .update(`sugar-scanner:${code}:${secret}`)
    .digest("hex");
}

export function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();

  const token = expectedToken();
  if (!token && process.env.NODE_ENV !== "production") return NextResponse.next();
  if (token && request.cookies.get(ACCESS_COOKIE)?.value === token) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Demo access required." },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  const accessUrl = request.nextUrl.clone();
  accessUrl.pathname = "/access";
  accessUrl.search = "";
  accessUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|apple-touch-icon.png|manifest.webmanifest|sw.js|brand/).*)"
  ]
};
