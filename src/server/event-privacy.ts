const forbiddenMetadataKey = /(image|frame|photo|base64|data.?url)/i;

export function metadataIsSafe(metadata: Record<string, string | number | boolean | null>): boolean {
  const entries = Object.entries(metadata);
  if (entries.length > 20) return false;
  return entries.every(([key, value]) => {
    if (forbiddenMetadataKey.test(key)) return false;
    if (typeof value !== "string") return true;
    return value.length <= 500 && !value.trimStart().startsWith("data:image/");
  });
}

export function classifyUserAgent(userAgent: string | null): string {
  if (!userAgent) return "unknown";
  if (/iPhone|iPad|iPod/i.test(userAgent) && /Safari/i.test(userAgent)) return "ios_safari";
  if (/Android/i.test(userAgent) && /Chrome/i.test(userAgent)) return "android_chrome";
  if (/Mobile/i.test(userAgent)) return "mobile_other";
  return "desktop";
}
