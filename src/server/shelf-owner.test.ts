import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOwnerToken, verifyOwnerToken, ownerEmailMatches, OWNER_SESSION_SECONDS } from "./shelf-owner";
beforeEach(() => { vi.stubEnv("SHELF_RESEARCH_QUEUE_ENABLED", "true"); vi.stubEnv("SHELF_OWNER_EMAIL", "owner@example.com"); vi.stubEnv("SHELF_OWNER_SECRET", "a".repeat(64)); });
afterEach(() => vi.unstubAllEnvs());
describe("private Shelf owner identity", () => {
  it("requires an exact normalized configured email", () => { expect(ownerEmailMatches(" OWNER@example.com ")).toBe(true); expect(ownerEmailMatches("other@example.com")).toBe(false); });
  it("separates link and session purposes", () => { const link = createOwnerToken("link")!; expect(verifyOwnerToken(link, "link")).toBe(true); expect(verifyOwnerToken(link, "session")).toBe(false); });
  it("rejects tampering and malformed tokens", () => { const token = createOwnerToken("session")!; expect(verifyOwnerToken(token + "x", "session")).toBe(false); expect(verifyOwnerToken("bad.token", "session")).toBe(false); expect(verifyOwnerToken(undefined, "session")).toBe(false); expect(verifyOwnerToken(token.split(".")[0] + "." + "é".repeat(43), "session")).toBe(false); });
  it("expires links after 15 minutes and sessions after a year", () => { const now = 1_000_000; expect(verifyOwnerToken(createOwnerToken("link", now)!, "link", now + 900_000)).toBe(false); const session = createOwnerToken("session", now)!; expect(verifyOwnerToken(session, "session", now + 900_000)).toBe(true); expect(verifyOwnerToken(session, "session", now + OWNER_SESSION_SECONDS * 1000)).toBe(false); });
  it("revokes existing tokens when the identity or secret changes", () => { const token = createOwnerToken("session")!; vi.stubEnv("SHELF_OWNER_EMAIL", "new@example.com"); expect(verifyOwnerToken(token, "session")).toBe(false); vi.stubEnv("SHELF_OWNER_EMAIL", "owner@example.com"); vi.stubEnv("SHELF_OWNER_SECRET", "b".repeat(64)); expect(verifyOwnerToken(token, "session")).toBe(false); });
  it("fails closed when disabled or unconfigured", () => { vi.stubEnv("SHELF_OWNER_SECRET", "short"); expect(createOwnerToken("link")).toBeNull(); vi.stubEnv("SHELF_OWNER_SECRET", "a".repeat(64)); vi.stubEnv("SHELF_RESEARCH_QUEUE_ENABLED", "false"); expect(createOwnerToken("session")).toBeNull(); });
});
