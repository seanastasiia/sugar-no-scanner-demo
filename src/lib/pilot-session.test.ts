import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STORAGE_KEY,
  PILOT_SESSION_STORAGE_KEY,
  readOnboardingCompletion,
  readPilotSession,
  saveOnboardingCompletion,
  savePilotSession
} from "./pilot-session";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

describe("pilot session storage", () => {
  it("stores only recognized onboarding states", () => {
    const storage = memoryStorage();
    expect(readOnboardingCompletion(storage)).toBeNull();
    expect(saveOnboardingCompletion(storage, "completed")).toBe(true);
    expect(storage.getItem(ONBOARDING_STORAGE_KEY)).toBe("completed");
    expect(readOnboardingCompletion(storage)).toBe("completed");
    storage.setItem(ONBOARDING_STORAGE_KEY, "unexpected");
    expect(readOnboardingCompletion(storage)).toBeNull();
  });

  it("keeps a valid session id and ignores malformed values", () => {
    const storage = memoryStorage();
    const id = "66f9424f-0483-4c3a-ae78-31738729c41e";
    savePilotSession(storage, id);
    expect(storage.getItem(PILOT_SESSION_STORAGE_KEY)).toBe(id);
    expect(readPilotSession(storage)).toBe(id);
    storage.setItem(PILOT_SESSION_STORAGE_KEY, "not-a-session");
    expect(readPilotSession(storage)).toBeNull();
  });

  it("fails closed when browser storage is unavailable", () => {
    const unavailable = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); }
    };
    expect(readOnboardingCompletion(unavailable)).toBeNull();
    expect(saveOnboardingCompletion(unavailable, "skipped")).toBe(false);
    expect(readPilotSession(unavailable)).toBeNull();
    expect(() => savePilotSession(unavailable, crypto.randomUUID())).not.toThrow();
  });
});
