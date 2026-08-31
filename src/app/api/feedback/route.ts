import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyUserAgent, metadataIsSafe } from "@/server/event-privacy";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
import { FixedWindowRateLimiter, recognitionClientKey } from "@/server/rate-limit";
import { getSupabaseAdmin } from "@/server/supabase";

const feedbackRateLimiter = new FixedWindowRateLimiter(10, 60_000);

const feedbackSchema = z.object({
  sessionId: z.uuid(),
  helpful: z.boolean(),
  reason: z.enum(["wrong_product", "no_result", "too_slow", "unclear", "other"]).nullable().optional(),
  comment: z.string().trim().max(300).default(""),
  context: z.enum(["camera", "results", "demo", "permission_error"])
}).superRefine((value, context) => {
  if (!value.helpful && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Reason is required" });
  }
  if (value.helpful && value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Reason must be empty" });
  }
});

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) return response({ error: "untrusted_origin" }, 403);

  const decision = feedbackRateLimiter.consume(recognitionClientKey(request));
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds },
      { status: 429, headers: { "retry-after": String(decision.retryAfterSeconds), "cache-control": "no-store" } }
    );
  }

  const parsed = feedbackSchema.safeParse(await readBoundedJson(request, 4_096).catch(() => null));
  if (!parsed.success) return response({ error: "invalid_feedback" }, 400);
  if (!metadataIsSafe({ comment: parsed.data.comment })) return response({ error: "unsafe_feedback" }, 400);

  const row = {
    id: randomUUID(),
    session_id: parsed.data.sessionId,
    helpful: parsed.data.helpful,
    reason: parsed.data.reason || null,
    comment: parsed.data.comment || null,
    context: parsed.data.context,
    user_agent_class: classifyUserAgent(request.headers.get("user-agent"))
  };
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error: sessionError } = await supabase.from("scan_sessions").upsert(
      {
        id: parsed.data.sessionId,
        source: parsed.data.context === "demo" ? "sample-shelf" : "camera",
        user_agent_class: row.user_agent_class
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
    if (sessionError) return response({ error: "session_storage_failed" }, 503);
    const { error } = await supabase.from("pilot_feedback").insert(row);
    if (error) return response({ error: "feedback_storage_failed" }, 503);
    return response({ ok: true, storage: "supabase" });
  }

  console.info(JSON.stringify({ event: "pilot_feedback", ...row }));
  return response({ ok: true, storage: "structured_log" });
}
