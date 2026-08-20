export interface SeenDetection {
  productId: string;
  seenAt: number;
}

export function mergeDetectionTray(
  tray: string[],
  seen: Map<string, number>,
  productIds: string[],
  now: number,
  cooldownMs = 5_000
): { tray: string[]; seen: Map<string, number>; added: string[] } {
  const nextTray = [...tray];
  const nextSeen = new Map(seen);
  const added: string[] = [];
  for (const productId of productIds) {
    const lastSeen = nextSeen.get(productId) ?? -Infinity;
    nextSeen.set(productId, now);
    if (now - lastSeen < cooldownMs || nextTray.includes(productId)) continue;
    nextTray.push(productId);
    added.push(productId);
  }
  return { tray: nextTray, seen: nextSeen, added };
}
