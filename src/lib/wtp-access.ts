export const FREE_REAL_SCANS = 3;
export const WTP_OFFER_VERSION = "seven-day-299-v1";
export const WTP_ACCESS_TOKEN_KEY = "sugar_scanner_access_token_v1";
export const WTP_FREE_SCAN_COUNT_KEY = "sugar_scanner_free_scans_v1";
export const WTP_ATTRIBUTION_KEY = "sugar_scanner_attribution_v1";

export type AcquisitionAttribution = Partial<Record<
  "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term",
  string
>>;

const attributionKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function bounded(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length <= 80 ? normalized : undefined;
}

export function readOrCreateAccessToken(storage: Pick<Storage, "getItem" | "setItem">): string {
  try {
    const existing = storage.getItem(WTP_ACCESS_TOKEN_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const token = crypto.randomUUID();
    storage.setItem(WTP_ACCESS_TOKEN_KEY, token);
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

export function readFreeScanCount(storage: Pick<Storage, "getItem">): number {
  try {
    const value = Number.parseInt(storage.getItem(WTP_FREE_SCAN_COUNT_KEY) || "0", 10);
    return Number.isFinite(value) ? Math.max(0, Math.min(FREE_REAL_SCANS, value)) : 0;
  } catch {
    return 0;
  }
}

export function recordFreeScan(storage: Pick<Storage, "getItem" | "setItem">): number {
  const next = Math.min(FREE_REAL_SCANS, readFreeScanCount(storage) + 1);
  try {
    storage.setItem(WTP_FREE_SCAN_COUNT_KEY, String(next));
  } catch {
    // Private browsing can disable storage. The in-memory count still updates.
  }
  return next;
}

export function captureAttribution(
  location: Pick<Location, "search">,
  storage: Pick<Storage, "getItem" | "setItem">
): AcquisitionAttribution {
  let current: AcquisitionAttribution = {};
  try {
    const stored = JSON.parse(storage.getItem(WTP_ATTRIBUTION_KEY) || "{}") as Record<string, unknown>;
    current = Object.fromEntries(
      attributionKeys.flatMap((key) => typeof stored[key] === "string" && bounded(stored[key] as string)
        ? [[key, bounded(stored[key] as string)!]]
        : [])
    );
  } catch {
    current = {};
  }
  const params = new URLSearchParams(location.search);
  for (const key of attributionKeys) {
    const value = bounded(params.get(key));
    if (value) current[key] = value;
  }
  try {
    storage.setItem(WTP_ATTRIBUTION_KEY, JSON.stringify(current));
  } catch {
    // Attribution remains available for the current page even without storage.
  }
  return current;
}
