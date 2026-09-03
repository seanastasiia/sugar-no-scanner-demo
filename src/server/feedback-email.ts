import { setTimeout as pause } from "node:timers/promises";

export type FeedbackEmail = {
  id: string;
  helpful: boolean;
  reason: string | null;
  comment: string | null;
  context: string;
};

export type FeedbackEmailDelivery = "disabled" | "sent" | "failed";

const reasons: Record<string, string> = {
  wrong_product: "Неверный товар",
  no_result: "Нет результата",
  too_slow: "Слишком медленно",
  unclear: "Непонятно",
  other: "Другое"
};

const contexts: Record<string, string> = {
  camera: "Камера",
  results: "Результаты",
  demo: "Демо",
  permission_error: "Доступ к камере"
};

// Require an explicit target matching Railway. Staging remains the safe legacy default.
export async function sendFeedbackEmail(feedback: FeedbackEmail): Promise<FeedbackEmailDelivery> {
  const environment = process.env.FEEDBACK_EMAIL_ENVIRONMENT?.trim() || "staging";
  if (process.env.FEEDBACK_EMAIL_ENABLED !== "true"
    || !["staging", "production"].includes(environment)
    || process.env.RAILWAY_ENVIRONMENT_NAME !== environment) {
    return "disabled";
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.FEEDBACK_EMAIL_FROM?.trim();
  const to = process.env.FEEDBACK_EMAIL_TO?.trim();
  const email = /^[^\s@<> ,;]+@[^\s@<> ,;]+\.[^\s@<> ,;]+$/;
  if (!apiKey || !from || !to || !email.test(from) || !email.test(to)) {
    console.warn(JSON.stringify({ event: "feedback_email", feedbackId: feedback.id, status: "invalid_config" }));
    return "failed";
  }

  const rating = feedback.helpful ? "Полезно" : "Нужно улучшить";
  // Plain text only. User text never controls recipients, headers, HTML, or credentials.
  const body = JSON.stringify({
    from: `Sugar.no Scanner <${from}>`,
    to: [to],
    subject: `[Sugar.no ${environment}] Новый отзыв: ${rating}`,
    text: [
      environment === "production" ? "Новый отзыв в основной версии Sugar.no Scanner" : "Новый отзыв в тестовой версии Sugar.no Scanner",
      "",
      `Оценка: ${rating}`,
      `Причина: ${feedback.reason ? reasons[feedback.reason] || "Другое" : "Не указана"}`,
      `Экран: ${contexts[feedback.context] || "Не указан"}`,
      `Время (UTC): ${new Date().toISOString()}`,
      `ID отзыва: ${feedback.id}`,
      "",
      "Комментарий пользователя:",
      feedback.comment || "Без комментария",
      "",
      `Отзыв сохранён в Supabase ${environment}, таблица pilot_feedback.`,
      "Это автоматическое уведомление. Пользователь анонимен; ответ на письмо ему не отправится."
    ].join("\n")
  });

  let failure = "network_or_timeout";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "Idempotency-Key": `scanner-feedback/${feedback.id}`
        },
        body,
        signal: AbortSignal.timeout(3_000)
      });
      if (response.ok) {
        const result = await response.json() as { id?: unknown };
        if (typeof result.id === "string" && result.id.length > 0) {
          console.info(JSON.stringify({ event: "feedback_email", feedbackId: feedback.id, status: "sent", emailId: result.id }));
          return "sent";
        }
        failure = "invalid_provider_response";
      } else {
        failure = `http_${response.status}`;
        // Authentication, validation and exhausted-quota errors need operator action.
        if (response.status < 500) break;
      }
    } catch {
      failure = "network_or_timeout";
    }
    if (attempt === 0) await pause(500);
  }

  // Never log the comment, recipient, key, or provider error body.
  console.warn(JSON.stringify({ event: "feedback_email", feedbackId: feedback.id, status: "failed", reason: failure }));
  return "failed";
}
