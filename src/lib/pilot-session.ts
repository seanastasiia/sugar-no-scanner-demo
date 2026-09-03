export const ONBOARDING_STORAGE_KEY = "sugar_scanner_onboarding_v1";
export const PILOT_SESSION_STORAGE_KEY = "sugar_scanner_session_v1";

export type OnboardingCompletion = "completed" | "skipped";

export function readOnboardingCompletion(storage: Pick<Storage, "getItem">): OnboardingCompletion | null {
  try {
    const value = storage.getItem(ONBOARDING_STORAGE_KEY);
    return value === "completed" || value === "skipped" ? value : null;
  } catch {
    return null;
  }
}

export function saveOnboardingCompletion(
  storage: Pick<Storage, "setItem">,
  value: OnboardingCompletion
): boolean {
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function readPilotSession(storage: Pick<Storage, "getItem">): string | null {
  try {
    const value = storage.getItem(PILOT_SESSION_STORAGE_KEY);
    return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function savePilotSession(storage: Pick<Storage, "setItem">, sessionId: string): void {
  try {
    storage.setItem(PILOT_SESSION_STORAGE_KEY, sessionId);
  } catch {
    // A private browser may disable storage. The in-memory session still works.
  }
}
