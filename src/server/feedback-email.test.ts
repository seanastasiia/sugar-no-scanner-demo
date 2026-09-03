import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendFeedbackEmail } from "./feedback-email";

const feedback = {
  id: "66f9424f-0483-4c3a-ae78-31738729c41e",
  helpful: false,
  reason: "unclear",
  comment: "<script>private user text</script>\nTo: someone@attacker.example",
  context: "demo",
  session_id: "must-not-be-sent",
  user_agent_class: "must-not-be-sent"
};

describe("feedback email", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FEEDBACK_EMAIL_ENABLED", "true");
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "staging");
    vi.stubEnv("FEEDBACK_EMAIL_ENVIRONMENT", "");
    vi.stubEnv("RESEND_API_KEY", "re_private-test-key");
    vi.stubEnv("FEEDBACK_EMAIL_FROM", "scanner@verified.example");
    vi.stubEnv("FEEDBACK_EMAIL_TO", "owner@example.com");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(["production", "local", ""]) ("does not send outside staging (%s)", async (environment) => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", environment);
    expect(await sendFeedbackEmail(feedback)).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send when explicitly disabled", async () => {
    vi.stubEnv("FEEDBACK_EMAIL_ENABLED", "false");
    expect(await sendFeedbackEmail(feedback)).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends production mail only with an explicitly matching target", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");
    vi.stubEnv("FEEDBACK_EMAIL_ENVIRONMENT", "production");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "production-email" }), { status: 200 }));
    expect(await sendFeedbackEmail(feedback)).toBe("sent");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe("[Sugar.no production] Новый отзыв: Нужно улучшить");
    expect(body.text).toContain("основной версии");
    expect(body.text).toContain("Supabase production");
    expect(body.text).not.toContain("staging");
  });

  it.each(["staging", "personal-rank-preview", "local", ""]) ("never leaks a production mail config into %s", async (environment) => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", environment);
    vi.stubEnv("FEEDBACK_EMAIL_ENVIRONMENT", "production");
    expect(await sendFeedbackEmail(feedback)).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported environments even when both values match", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "personal-rank-preview");
    vi.stubEnv("FEEDBACK_EMAIL_ENVIRONMENT", "personal-rank-preview");
    expect(await sendFeedbackEmail(feedback)).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["RESEND_API_KEY", "FEEDBACK_EMAIL_FROM", "FEEDBACK_EMAIL_TO"]) ("fails safely with missing %s", async (key) => {
    vi.stubEnv(key, "");
    expect(await sendFeedbackEmail(feedback)).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects multiple recipients or header injection in configuration", async () => {
    vi.stubEnv("FEEDBACK_EMAIL_TO", "owner@example.com,attacker@example.com");
    expect(await sendFeedbackEmail(feedback)).toBe("failed");
    vi.stubEnv("FEEDBACK_EMAIL_TO", "owner@example.com\r\nBcc: attacker@example.com");
    expect(await sendFeedbackEmail(feedback)).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only allowed data as plain text to the configured owner", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "email-123" }), { status: 200 }));
    expect(await sendFeedbackEmail(feedback)).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.from).toBe("Sugar.no Scanner <scanner@verified.example>");
    expect(body.subject).toBe("[Sugar.no staging] Новый отзыв: Нужно улучшить");
    expect(body.text).toContain("Причина: Непонятно");
    expect(body.text).toContain(feedback.comment);
    expect(body.html).toBeUndefined();
    expect(init.body).not.toContain("must-not-be-sent");
    expect(init.headers["Idempotency-Key"]).toBe(`scanner-feedback/${feedback.id}`);
    expect(init.signal).toBeDefined();
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(feedback.comment);
  });

  it("renders a positive rating without a comment", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "email-123" }), { status: 200 }));
    expect(await sendFeedbackEmail({ ...feedback, helpful: true, reason: null, comment: null })).toBe("sent");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain("Оценка: Полезно");
    expect(body.text).toContain("Без комментария");
  });

  it("retries a transient error with identical body and idempotency key", async () => {
    fetchMock.mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "email-123" }), { status: 200 }));
    expect(await sendFeedbackEmail(feedback)).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[0][1].headers).toEqual(fetchMock.mock.calls[1][1].headers);
  });

  it.each([400, 401, 403, 429])("does not retry permanent/quota HTTP %s", async (status) => {
    fetchMock.mockResolvedValue(new Response("private provider payload", { status }));
    expect(await sendFeedbackEmail(feedback)).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const logs = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logs).not.toContain("private");
    expect(logs).not.toContain("owner@example.com");
  });

  it("bounds network/timeout retries and never rejects", async () => {
    fetchMock.mockRejectedValue(new Error("private key/body must not be logged"));
    expect(await sendFeedbackEmail(feedback)).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private");
  });
});
