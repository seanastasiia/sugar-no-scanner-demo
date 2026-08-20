import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "sugar-no-scanner-demo",
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "local",
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
