import type { BoundingBox, ProductDetection } from "./types";

const genericIdentityTokens = new Set([
  "beverage",
  "bottle",
  "can",
  "drink",
  "drinks",
  "original",
  "pack",
  "product",
  "taste"
]);

function normalizedTokens(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(
      (token) =>
        token.length >= 2 &&
        !/^\d+(?:ml|cl|l|g|kg)?$/.test(token) &&
        !["ml", "cl", "kg", "pcs", "gab"].includes(token)
    );
}

export function productDetectionKey(detection: ProductDetection): string {
  if (detection.catalogProductId) return `catalog:${detection.catalogProductId}`;
  if (detection.retailerOffer?.exactSku) return `retailer:${detection.retailerOffer.slug}`;
  if (!detection.identity) return `product:${detection.productId}`;

  const brandTokens = normalizedTokens(detection.identity.brand);
  const brandKey = brandTokens.join("");
  const ignored = new Set([...brandTokens, ...genericIdentityTokens]);
  const identityTokens = normalizedTokens(
    `${detection.identity.name} ${detection.identity.variant || ""} ${detection.identity.packSize || ""}`
  )
    .filter((token) => !ignored.has(token))
    .sort();
  return `identity:${brandKey || "unknown"}:${[...new Set(identityTokens)].join("-") || "base"}`;
}

function unionBoxes(left: BoundingBox, right: BoundingBox): BoundingBox {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const farRight = Math.max(left.x + left.width, right.x + right.width);
  const bottom = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: Math.min(1 - x, farRight - x), height: Math.min(1 - y, bottom - y) };
}

export function dedupeProductDetections(detections: ProductDetection[]): ProductDetection[] {
  const unique = new Map<string, ProductDetection>();
  for (const detection of detections) {
    const key = productDetectionKey(detection);
    const previous = unique.get(key);
    if (!previous) {
      unique.set(key, detection);
      continue;
    }

    const preferred = detection.confidence > previous.confidence ? detection : previous;
    const shelfPrice = [previous.shelfPrice, detection.shelfPrice]
      .filter((price): price is NonNullable<typeof price> => Boolean(price))
      .sort((left, right) => right.confidence - left.confidence)[0] || null;
    const retailerOffer = [previous.retailerOffer, detection.retailerOffer]
      .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer))
      .sort(
        (left, right) =>
          Number(right.exactSku) - Number(left.exactSku) || right.matchConfidence - left.matchConfidence
      )[0] || null;

    unique.set(key, {
      ...preferred,
      catalogProductId: preferred.catalogProductId || previous.catalogProductId || detection.catalogProductId || null,
      box: unionBoxes(previous.box, detection.box),
      shelfPrice,
      retailerOffer
    });
  }
  return [...unique.values()];
}
