import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ACCESS_COOKIE = "sugar_scanner_access";

function configuredCode(): string | null {
  const value = process.env.DEMO_ACCESS_CODE?.trim();
  return value ? value : null;
}

export function accessProtectionEnabled(): boolean {
  return Boolean(configuredCode()) || process.env.NODE_ENV === "production";
}

export function sessionToken(): string {
  const code = configuredCode();
  const secret = process.env.DEMO_SESSION_SECRET?.trim();
  if (!code || !secret) return "";
  return createHash("sha256").update(`sugar-scanner:${code}:${secret}`).digest("hex");
}

export function accessCodeMatches(candidate: string): boolean {
  const code = configuredCode();
  if (!code) return process.env.NODE_ENV !== "production";
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const codeDigest = createHash("sha256").update(code).digest();
  return timingSafeEqual(candidateDigest, codeDigest);
}

export async function isAuthorized(): Promise<boolean> {
  if (!accessProtectionEnabled()) return true;
  const expected = sessionToken();
  if (!expected) return false;
  return (await cookies()).get(ACCESS_COOKIE)?.value === expected;
}
