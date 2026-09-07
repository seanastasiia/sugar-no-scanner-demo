import { NextResponse } from "next/server";
import { z } from "zod";
import { billingEnabled, hashAccessToken, hashRestoreToken } from "@/server/billing";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
import { getSupabaseAdmin } from "@/server/supabase";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";

const limiter = createRecognitionRateLimiter({ BILLING_RESTORE_CLAIM_RATE_LIMIT: "20" });

const schema = z.object({ accessToken: z.uuid(), restoreToken: z.string().min(32).max(180) });

export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) return NextResponse.json({ error: "untrusted_origin" }, { status: 403 });
  const decision = limiter.consume(recognitionClientKey(request));
  if (!decision.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!billingEnabled()) return NextResponse.json({ error: "billing_disabled" }, { status: 404 });
  const parsed = schema.safeParse(await readBoundedJson(request, 2_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_restore" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "restore_unavailable" }, { status: 503 });
  const { data, error } = await supabase.rpc("claim_scanner_restore_token", {
    p_restore_hash: hashRestoreToken(parsed.data.restoreToken),
    p_access_hash: hashAccessToken(parsed.data.accessToken)
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error) return NextResponse.json({ error: "restore_failed" }, { status: 503 });
  if (!row?.expires_at) return NextResponse.json({ error: "restore_expired" }, { status: 400 });
  return NextResponse.json({ active: true, expiresAt: row.expires_at }, { headers: { "cache-control": "no-store" } });
}
