import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendAmplitudeEvent } from "@/server/amplitude";
import { classifyUserAgent, metadataIsSafe } from "@/server/event-privacy";
import { readBoundedJson } from "@/server/request-body";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
import { createRecognitionRateLimiter, recognitionClientKey } from "@/server/rate-limit";
import { getSupabaseAdmin } from "@/server/supabase";

const eventsRateLimiter = createRecognitionRateLimiter({ RECOGNITION_RATE_LIMIT: "300" });

const eventSchema = z.object({
  sessionId: z.uuid(),
  name: z.enum([
    "app_opened",
    "onboarding_started",
    "onboarding_step_viewed",
    "onboarding_completed",
    "onboarding_skipped",
    "camera_permission_requested",
    "camera_permission_granted",
    "feedback_opened",
    "feedback_submitted",
    "scan_started",
    "scan_completed",
    "result_opened",
    "alternative_viewed",
    "retailer_link_clicked",
    "permission_denied",
    "recognition_failed"
  ]),
  source: z.enum(["camera", "upload", "sample-shelf", "sample-conveyor"]),
  productId: z.string().max(180).nullable().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({})
});

export async function POST(request: Request) {
  if (!hasTrustedBrowserOrigin(request)) {
    return NextResponse.json(
      { error: "untrusted_origin" },
      { status: 403, headers: { "cache-control": "no-store" } }
    );
  }
  const decision = eventsRateLimiter.consume(recognitionClientKey(request));
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds },
      {
        status: 429,
        headers: { "retry-after": String(decision.retryAfterSeconds), "cache-control": "no-store" }
      }
    );
  }
  const parsed = eventSchema.safeParse(await readBoundedJson(request, 32_000).catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_event" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }
  if (!metadataIsSafe(parsed.data.metadata)) {
    return NextResponse.json(
      { error: "unsafe_event_metadata" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }
  const row = {
    id: randomUUID(),
    session_id: parsed.data.sessionId,
    event_name: parsed.data.name,
    source: parsed.data.source,
    product_id: parsed.data.productId || null,
    metadata: parsed.data.metadata
  };
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error: sessionError } = await supabase.from("scan_sessions").upsert(
      {
        id: parsed.data.sessionId,
        source: parsed.data.source,
        user_agent_class: classifyUserAgent(request.headers.get("user-agent"))
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
    if (sessionError) {
      return NextResponse.json(
        { error: "session_storage_failed" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    }
    const { error } = await supabase.from("scan_events").insert(row);
    if (error) {
      return NextResponse.json(
        { error: "event_storage_failed" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    }
    if (parsed.data.name === "scan_completed") {
      await supabase
        .from("scan_sessions")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", parsed.data.sessionId);
    }
    const amplitude = await sendAmplitudeEvent({
      id: row.id,
      sessionId: row.session_id,
      name: row.event_name,
      source: row.source,
      metadata: row.metadata
    });
    if (amplitude === "failed") {
      console.warn(JSON.stringify({ event: "amplitude_delivery_failed", eventName: row.event_name }));
    }
    return NextResponse.json(
      { ok: true, storage: "supabase", analytics: amplitude },
      { headers: { "cache-control": "no-store" } }
    );
  }
  console.info(JSON.stringify({ event: "scan_event", ...row }));
  const amplitude = await sendAmplitudeEvent({
    id: row.id,
    sessionId: row.session_id,
    name: row.event_name,
    source: row.source,
    metadata: row.metadata
  });
  if (amplitude === "failed") {
    console.warn(JSON.stringify({ event: "amplitude_delivery_failed", eventName: row.event_name }));
  }
  return NextResponse.json(
    { ok: true, storage: "structured_log", analytics: amplitude },
    { headers: { "cache-control": "no-store" } }
  );
}
