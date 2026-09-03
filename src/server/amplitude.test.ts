import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { amplitudeEventProperties, sendAmplitudeEvent, type AmplitudeEvent } from "./amplitude";

const originalApiKey = process.env.AMPLITUDE_API_KEY;
const originalEnvironment = process.env.AMPLITUDE_ENVIRONMENT;

const event: AmplitudeEvent = {
  id: "70e48f01-c439-4524-b290-90cb4b951151",
  sessionId: "6a3fce65-9da8-4a7f-b075-245eeef4ce08",
  name: "scan_completed",
  source: "camera",
  metadata: {
    count: 4,
    latencyMs: 3_250,
    meanConfidence: 0.84,
    model: "gemini-flash",
    message: "Recognition returned 503",
    comment: "private feedback",
    productId: "private-product-id"
  }
};

beforeEach(() => {
  delete process.env.AMPLITUDE_API_KEY;
  process.env.AMPLITUDE_ENVIRONMENT = "staging";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.AMPLITUDE_API_KEY;
  else process.env.AMPLITUDE_API_KEY = originalApiKey;
  if (originalEnvironment === undefined) delete process.env.AMPLITUDE_ENVIRONMENT;
  else process.env.AMPLITUDE_ENVIRONMENT = originalEnvironment;
});

describe("Amplitude analytics", () => {
  it("does nothing when the server-side project key is absent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendAmplitudeEvent(event)).resolves.toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one anonymous event to the EU ingestion endpoint", async () => {
    process.env.AMPLITUDE_API_KEY = "test-project-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response("success", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendAmplitudeEvent(event)).resolves.toBe("sent");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.eu.amplitude.com/2/httpapi");
    const body = JSON.parse(String(request.body));
    expect(body.api_key).toBe("test-project-key");
    expect(body.events[0]).toMatchObject({
      device_id: event.sessionId,
      event_type: "scan_completed",
      insert_id: event.id,
      platform: "Web",
      event_properties: {
        source: "camera",
        environment: "staging",
        recognized_count: 4,
        recognition_latency_ms: 3_250,
        recognition_latency_bucket: "2_to_5s",
        mean_confidence: 0.84,
        recognition_model: "gemini-flash",
        error_category: "recognition_http_error"
      }
    });
    expect(JSON.stringify(body)).not.toContain("private feedback");
    expect(JSON.stringify(body)).not.toContain("private-product-id");
  });

  it("fails open when Amplitude is unavailable", async () => {
    process.env.AMPLITUDE_API_KEY = "test-project-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(sendAmplitudeEvent(event)).resolves.toBe("failed");
  });

  it("keeps only the approved property allowlist", () => {
    expect(amplitudeEventProperties(event)).toEqual({
      source: "camera",
      environment: "staging",
      recognized_count: 4,
      recognition_latency_ms: 3_250,
      recognition_latency_bucket: "2_to_5s",
      recognition_model: "gemini-flash",
      mean_confidence: 0.84,
      error_category: "recognition_http_error"
    });
  });
});
