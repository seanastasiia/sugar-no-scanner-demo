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
  if (detection.identity?.matchKind !== "visual_only" && !detection.productId.startsWith("visual:")) {
    return `resolved:${detection.productId}`;
  }
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

function containsBox(outer: BoundingBox, inner: BoundingBox): boolean {
  const epsilon = 1e-9;
  return outer.x <= inner.x + epsilon &&
    outer.y <= inner.y + epsilon &&
    outer.x + outer.width + epsilon >= inner.x + inner.width &&
    outer.y + outer.height + epsilon >= inner.y + inner.height;
}

function overlapOfSmallerBox(left: BoundingBox, right: BoundingBox): number {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  const intersection = width * height;
  const smallerArea = Math.min(left.width * left.height, right.width * right.height);
  return smallerArea > 0 ? intersection / smallerArea : 0;
}

function canonicalPack(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replaceAll(",", ".").replace(/\s+/g, "");
  const match = normalized.match(/(\d+(?:\.\d+)?)(kg|g|ml|cl|l)\b/);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]);
  const unit = match[2];
  const factor = unit === "kg" || unit === "l" ? 1_000 : unit === "cl" ? 10 : 1;
  return `${unit === "ml" || unit === "cl" || unit === "l" ? "liquid" : "solid"}:${amount * factor}`;
}

function samePhysicalMultilingualSku(left: ProductDetection, right: ProductDetection): boolean {
  if (!left.identity || !right.identity || overlapOfSmallerBox(left.box, right.box) < 0.65) return false;
  const leftBrand = normalizedTokens(left.identity.brand).join("");
  const rightBrand = normalizedTokens(right.identity.brand).join("");
  if (!leftBrand || leftBrand !== rightBrand) return false;
  const leftPack = canonicalPack(left.identity.packSize);
  const rightPack = canonicalPack(right.identity.packSize);
  return !leftPack || !rightPack || leftPack === rightPack;
}

function resolutionStrength(detection: ProductDetection): number {
  if (detection.inlineProduct || detection.catalogProductId) return 3;
  if (detection.identity?.matchKind && detection.identity.matchKind !== "visual_only") return 2;
  return 1;
}

function mergeDetections(previous: ProductDetection, detection: ProductDetection): ProductDetection {
  const preferred = resolutionStrength(detection) > resolutionStrength(previous)
    ? detection
    : resolutionStrength(detection) < resolutionStrength(previous)
      ? previous
      : detection.confidence > previous.confidence
        ? detection
        : previous;
  const shelfPrice = [previous.shelfPrice, detection.shelfPrice]
    .filter((price): price is NonNullable<typeof price> => Boolean(price))
    .sort((left, right) => right.confidence - left.confidence)[0] || null;
  const retailerOffer = [previous.retailerOffer, detection.retailerOffer]
    .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer))
    .sort(
      (left, right) =>
        Number(right.exactSku) - Number(left.exactSku) || right.matchConfidence - left.matchConfidence
    )[0] || null;

  const other = preferred === previous ? detection : previous;
  const merged: ProductDetection = {
    ...preferred,
    box: containsBox(preferred.box, other.box) ? preferred.box : unionBoxes(previous.box, detection.box)
  };
  const catalogProductId = preferred.catalogProductId || previous.catalogProductId || detection.catalogProductId;
  const inlineProduct = preferred.inlineProduct || previous.inlineProduct || detection.inlineProduct;
  if (catalogProductId) merged.catalogProductId = catalogProductId;
  else if ("catalogProductId" in preferred) merged.catalogProductId = preferred.catalogProductId;
  if (shelfPrice) merged.shelfPrice = shelfPrice;
  else if ("shelfPrice" in preferred) merged.shelfPrice = preferred.shelfPrice;
  if (retailerOffer) merged.retailerOffer = retailerOffer;
  else if ("retailerOffer" in preferred) merged.retailerOffer = preferred.retailerOffer;
  if (inlineProduct) merged.inlineProduct = inlineProduct;
  else if ("inlineProduct" in preferred) merged.inlineProduct = preferred.inlineProduct;
  return merged;
}

export function dedupeProductDetections(detections: ProductDetection[]): ProductDetection[] {
  const unique: ProductDetection[] = [];
  for (const detection of detections) {
    const key = productDetectionKey(detection);
    const duplicateIndex = unique.findIndex(
      (candidate) => productDetectionKey(candidate) === key || samePhysicalMultilingualSku(candidate, detection)
    );
    if (duplicateIndex < 0) {
      unique.push(detection);
      continue;
    }
    unique[duplicateIndex] = mergeDetections(unique[duplicateIndex], detection);
  }
  return unique;
}
