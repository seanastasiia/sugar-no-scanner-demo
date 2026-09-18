import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const OWNER_COOKIE = "sugar_shelf_owner";
export const OWNER_SESSION_SECONDS = 365 * 24 * 60 * 60;
const LINK_SECONDS = 15 * 60;
type Purpose = "link" | "session";

function config() {
  const email = process.env.SHELF_OWNER_EMAIL?.trim().toLowerCase();
  const secret = process.env.SHELF_OWNER_SECRET?.trim();
  if (process.env.SHELF_RESEARCH_QUEUE_ENABLED !== "true" || !email || !secret || secret.length < 32) return null;
  return { email, secret, subject: createHash("sha256").update(email).digest("hex") };
}
export function ownerEmailMatches(email: string) {
  return Boolean(config()?.email === email.trim().toLowerCase());
}
export function createOwnerToken(purpose: Purpose, now = Date.now()) {
  const c = config();
  if (!c) return null;
  const payload = Buffer.from(JSON.stringify({ purpose, subject: c.subject, exp: Math.floor(now / 1000) + (purpose === "link" ? LINK_SECONDS : OWNER_SESSION_SECONDS), nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${payload}.${createHmac("sha256", c.secret).update(payload).digest("base64url")}`;
}
export function verifyOwnerToken(token: string | undefined, purpose: Purpose, now = Date.now()) {
  const c = config();
  if (!c || !token || token.length > 1000) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  const expected = createHmac("sha256", c.secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.purpose === purpose && data.subject === c.subject && Number.isSafeInteger(data.exp) && data.exp > Math.floor(now / 1000);
  } catch { return false; }
}
