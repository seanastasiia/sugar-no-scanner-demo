import { createHash } from "node:crypto";

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, now?: number): RateLimitDecision;
}

// The camera captures roughly 29 frames/minute at its 2.1s cadence. Keep a
// small bounded retry margin without turning public recognition into an
// unlimited endpoint.
const DEFAULT_RECOGNITION_RATE_LIMIT = 36;
const DEFAULT_RECOGNITION_RATE_WINDOW_SECONDS = 60;

interface WindowEntry {
  count: number;
  resetsAt: number;
}

export class FixedWindowRateLimiter implements RateLimiter {
  private readonly entries = new Map<string, WindowEntry>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 5_000
  ) {}

  consume(key: string, now = Date.now()): RateLimitDecision {
    let entry = this.entries.get(key);
    if (!entry || entry.resetsAt <= now) {
      if (!entry && this.entries.size >= this.maxKeys) {
        const oldestKey = this.entries.keys().next().value as string | undefined;
        if (oldestKey) this.entries.delete(oldestKey);
      }
      entry = { count: 0, resetsAt: now + this.windowMs };
      this.entries.set(key, entry);
    }
    entry.count += 1;
    const allowed = entry.count <= this.limit;
    return {
      allowed,
      remaining: Math.max(0, this.limit - entry.count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((entry.resetsAt - now) / 1_000))
    };
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createRecognitionRateLimiter(
  environment: Record<string, string | undefined> = process.env
): FixedWindowRateLimiter {
  return new FixedWindowRateLimiter(
    positiveInteger(environment.RECOGNITION_RATE_LIMIT, DEFAULT_RECOGNITION_RATE_LIMIT),
    positiveInteger(environment.RECOGNITION_RATE_WINDOW_SECONDS, DEFAULT_RECOGNITION_RATE_WINDOW_SECONDS) * 1_000
  );
}

export function recognitionClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 240) || "unknown";
  return createHash("sha256").update(`${address}|${userAgent}`).digest("hex");
}
