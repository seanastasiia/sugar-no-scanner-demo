import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ACCESS_COOKIE = "sugar_scanner_access";

function configuredCode() {
  return process.env.DEMO_ACCESS_CODE?.trim() ?? "";
}

function configuredSecret() {
  return process.env.DEMO_SESSION_SECRET?.trim() ?? "";
}

export function accessProtectionEnabled() {
  return Boolean(configuredCode()) || process.env.NODE_ENV === "production";
}

export function sessionToken() {
  const code = configuredCode();
  const secret = configuredSecret();
  if (!code || !secret) return null;
  return createHash("sha256")
    .update(`sugar-scanner:${code}:${secret}`)
    .digest("hex");
}

export function accessCodeMatches(candidate: string) {
  const expected = configuredCode();
  if (!expected) return process.env.NODE_ENV !== "production";
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

export async function isAuthorized() {
  if (!accessProtectionEnabled()) return true;
  const token = sessionToken();
  if (!token) return false;
  return (await cookies()).get(ACCESS_COOKIE)?.value === token;
}
