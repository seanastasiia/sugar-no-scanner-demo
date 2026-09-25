const QA_KEY = "sugar_scanner_qa_visit_v1";

// A session-scoped, explicit test label. Absence is unmarked, not proof of a human.
export function readQaVisit(search: string, storage: Pick<Storage, "getItem" | "setItem">): boolean {
  const explicit = new URLSearchParams(search).get("qa") === "1";
  try {
    if (explicit) storage.setItem(QA_KEY, "1");
    return explicit || storage.getItem(QA_KEY) === "1";
  } catch { return explicit; }
}

export function cameraFailureCategory(error: unknown): string {
  const name = typeof error === "object" && error !== null && "name" in error && typeof error.name === "string" ? error.name : "";
  if (["NotAllowedError", "SecurityError"].includes(name)) return "camera_denied";
  if (["NotFoundError", "DevicesNotFoundError"].includes(name)) return "camera_not_found";
  if (["NotReadableError", "TrackStartError"].includes(name)) return "camera_busy";
  return "camera_start_failed";
}

const CAMPAIGN_KEY = "sugar_scanner_entry_campaign_v1";
// Acquisition for this anonymous tab visit, separate from stored WTP attribution.
export function entryCampaign(search: string, storage: Pick<Storage, "getItem" | "setItem">): string {
  const raw = new URLSearchParams(search).get("utm_campaign")?.trim() || "";
  const current = /^[a-zA-Z0-9_-]{1,80}$/.test(raw) ? raw : "";
  try {
    const saved = storage.getItem(CAMPAIGN_KEY);
    if (saved !== null) return saved;
    storage.setItem(CAMPAIGN_KEY, current);
  } catch { /* The URL remains usable if storage is blocked. */ }
  return current;
}
