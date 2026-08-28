export function hasTrustedBrowserOrigin(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const host = request.headers.get("x-forwarded-host")?.trim()
    || request.headers.get("host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const publicOrigin = host
    ? `${forwardedProto || new URL(request.url).protocol.replace(":", "")}://${host}`
    : requestOrigin;
  const trustedOrigins = new Set([requestOrigin, publicOrigin]);
  const origin = request.headers.get("origin")?.trim();
  if (origin) {
    try {
      return trustedOrigins.has(new URL(origin).origin);
    } catch {
      return false;
    }
  }

  // Chromium may omit Origin on a same-origin JSON POST. Preserve that valid
  // browser path while rejecting explicit cross-site fetch metadata/referrers.
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") return false;

  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    try {
      return trustedOrigins.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}
