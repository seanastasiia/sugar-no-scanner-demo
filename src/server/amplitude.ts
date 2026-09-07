type AnalyticsMetadata = Record<string, string | number | boolean | null>;

export type AmplitudeEvent = {
  id: string;
  sessionId: string;
  browserSessionId?: string;
  name: string;
  source: string;
  metadata: AnalyticsMetadata;
};

export type AmplitudeDelivery = "disabled" | "sent" | "failed";

const EU_INGESTION_URL = "https://api.eu.amplitude.com/2/httpapi";
const MAX_STRING_PROPERTY_LENGTH = 80;

function boundedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_STRING_PROPERTY_LENGTH) return undefined;
  return normalized;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function latencyBucket(latencyMs: number): string {
  if (latencyMs < 2_000) return "under_2s";
  if (latencyMs < 5_000) return "2_to_5s";
  if (latencyMs < 10_000) return "5_to_10s";
  return "10s_plus";
}

function safeErrorCategory(value: unknown): string | undefined {
  const message = boundedString(value)?.toLowerCase();
  if (!message) return undefined;
  if (message === "rate_limited") return "rate_limited";
  if (message === "upload_multi_pass_failed") return "upload_multi_pass_failed";
  if (/^recognition returned [45]\d\d$/.test(message)) return "recognition_http_error";
  return "unknown";
}

export function amplitudeEventProperties(event: AmplitudeEvent): AnalyticsMetadata {
  const metadata = event.metadata;
  const properties: AnalyticsMetadata = {
    source: event.source,
    environment: process.env.AMPLITUDE_ENVIRONMENT?.trim() || "unknown"
  };

  const onboardingVersion = finiteNumber(metadata.onboardingVersion);
  const step = finiteNumber(metadata.step);
  const recognizedCount = finiteNumber(metadata.count);
  const latencyMs = finiteNumber(metadata.latencyMs);
  const minConfidence = finiteNumber(metadata.minConfidence);
  const meanConfidence = finiteNumber(metadata.meanConfidence);
  const retryAfterSeconds = finiteNumber(metadata.retryAfterSeconds);
  const frameCount = finiteNumber(metadata.frameCount);
  const model = boundedString(metadata.model);
  const placement = boundedString(metadata.placement);
  const errorCategory = safeErrorCategory(metadata.message);
  const freeScanCount = finiteNumber(metadata.freeScanCount);
  const utmSource = boundedString(metadata.utm_source);
  const utmMedium = boundedString(metadata.utm_medium);
  const utmCampaign = boundedString(metadata.utm_campaign);
  const utmContent = boundedString(metadata.utm_content);
  const utmTerm = boundedString(metadata.utm_term);

  if (onboardingVersion !== undefined) properties.onboarding_version = onboardingVersion;
  if (step !== undefined) properties.step = step;
  if (typeof metadata.helpful === "boolean") properties.helpful = metadata.helpful;
  if (placement) properties.placement = placement;
  if (recognizedCount !== undefined) properties.recognized_count = recognizedCount;
  if (latencyMs !== undefined) {
    properties.recognition_latency_ms = latencyMs;
    properties.recognition_latency_bucket = latencyBucket(latencyMs);
  }
  if (model) properties.recognition_model = model;
  if (minConfidence !== undefined) properties.min_confidence = minConfidence;
  if (meanConfidence !== undefined) properties.mean_confidence = meanConfidence;
  if (retryAfterSeconds !== undefined) properties.retry_after_seconds = retryAfterSeconds;
  if (frameCount !== undefined) properties.frame_count = frameCount;
  if (errorCategory) properties.error_category = errorCategory;
  if (freeScanCount !== undefined) properties.free_scan_count = freeScanCount;
  if (utmSource) properties.utm_source = utmSource;
  if (utmMedium) properties.utm_medium = utmMedium;
  if (utmCampaign) properties.utm_campaign = utmCampaign;
  if (utmContent) properties.utm_content = utmContent;
  if (utmTerm) properties.utm_term = utmTerm;

  return properties;
}

export async function sendAmplitudeEvent(event: AmplitudeEvent): Promise<AmplitudeDelivery> {
  const apiKey = process.env.AMPLITUDE_API_KEY?.trim();
  if (!apiKey) return "disabled";

  try {
    const response = await fetch(EU_INGESTION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        events: [
          {
            device_id: event.browserSessionId || event.sessionId,
            event_type: event.name,
            insert_id: event.id,
            time: Date.now(),
            platform: "Web",
            event_properties: amplitudeEventProperties(event)
          }
        ]
      }),
      signal: AbortSignal.timeout(1_500)
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
