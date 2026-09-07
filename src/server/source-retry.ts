export const SOURCE_RETRY_FALLBACK_MS = 6 * 60 * 60 * 1_000;

/** Convert Retry-After to an absolute durable boundary. Never shortens a source instruction. */
export function retryNotBefore(value: string | null, now = Date.now()): string {
  const seconds = value?.trim().match(/^\d+$/) ? Number(value) : Number.NaN;
  const parsedDate = value && !Number.isFinite(seconds) ? Date.parse(value) : Number.NaN;
  const target = Number.isFinite(seconds) ? now + seconds * 1_000
    : Number.isFinite(parsedDate) && parsedDate > now ? parsedDate
      : now + SOURCE_RETRY_FALLBACK_MS;
  return new Date(target).toISOString();
}

export function retryBoundaryElapsed(value: string | null | undefined, now = Date.now()): boolean {
  return !value || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= now;
}
