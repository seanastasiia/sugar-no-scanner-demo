import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { mergeUploadScanResults, uploadScanCrops } from "../src/lib/upload-scan";
import { rankPersonalShelfProducts, SHELF_MODEL_VERSION } from "../src/lib/personal-shelf-rank";
import type { ProductDetection, RecognitionResponse, ScoredProduct } from "../src/lib/types";

// Opt-in real-provider replay. Images stay in memory; stdout contains metadata only.
// Uses the client's crop geometry/1280px/JPEG quality, but Sharp rather than canvas.
const [originValue, imagePath] = process.argv.slice(2);
if (!originValue || !imagePath) throw new Error("Usage: npx tsx scripts/check-personal-shelf-photo.ts <preview-origin> <image-path>");
const origin = new URL(originValue);
if (origin.origin !== originValue.replace(/\/$/, "") || ![
  "sugar-no-personal-rank-personal-rank-preview.up.railway.app", "localhost", "127.0.0.1"
].includes(origin.hostname)) throw new Error("Only the isolated preview or local server is allowed");
const health = await (await fetch(new URL("/api/health", origin), { signal: AbortSignal.timeout(15000) })).json();
console.error(JSON.stringify({ stage: "health", origin: origin.origin }));
let cookie: string | null = null;
if (process.env.DEMO_ACCESS_CODE) {
  const response = await fetch(new URL("/api/auth", origin), { method: "POST", headers: { origin: origin.origin, "content-type": "application/json" }, body: JSON.stringify({ code: process.env.DEMO_ACCESS_CODE }) });
  if (!response.ok) throw new Error(`Auth HTTP ${response.status}`);
  cookie = response.headers.get("set-cookie")?.split(";")[0] || null;
}
// The public entry establishes a session without exposing it in the report.
if (!cookie) {
  const entry = await fetch(origin, { signal: AbortSignal.timeout(15000) });
  cookie = entry.headers.get("set-cookie")?.split(";")[0] || null;
}
const headers = { origin: origin.origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) };
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(new URL(path, origin), { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })
    .catch((error) => { throw new Error(`${path}: ${error instanceof Error ? error.message : "request failed"}`); });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}, Retry-After ${response.headers.get("retry-after") || "none"}`);
  return response.json();
}
const bytes = await readFile(imagePath);
const { width, height } = await sharp(bytes).metadata();
if (!width || !height) throw new Error("Image dimensions unavailable");
const started = Date.now();
const frames = await Promise.all(uploadScanCrops(width, height).map(async (crop) => {
  const buffer = await sharp(bytes).extract({ left: Math.round(width * crop.x), top: Math.round(height * crop.y), width: Math.round(width * crop.width), height: Math.round(height * crop.height) })
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
  const imageDataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
  if (imageDataUrl.length > 2_650_000) throw new Error("Frame exceeds the client size limit");
  const response = await post<RecognitionResponse>("/api/recognize", { source: "upload", imageDataUrl });
  console.error(JSON.stringify({ stage: "frame", requestId: response.requestId, status: response.status, count: response.detections.length }));
  if (response.imageStored !== false) throw new Error("Recognition privacy contract failed");
  return { crop, response };
}));
const merged = mergeUploadScanResults(frames);
console.error(JSON.stringify({ stage: "recognized", detections: merged.detections.length }));
let detections = merged.detections;
if (detections.length) {
  // Same one-product requests as progressive client enrichment, in bounded waves.
  const resolved: ProductDetection[] = [];
  for (let index = 0; index < detections.length; index += 5) {
    resolved.push(...(await Promise.all(detections.slice(index, index + 5).map(async (detection) => {
      const result = await post<{ detections: ProductDetection[]; imageStored: false }>("/api/resolve-products", { detections: [detection] });
      if (result.imageStored !== false) throw new Error("Enrichment privacy contract failed");
      return result.detections[0] || detection;
    }))));
  }
  detections = resolved;
}
const products = (await Promise.all(detections.map(async (detection) => {
  if (detection.inlineProduct) return detection.inlineProduct;
  const response = await fetch(new URL(`/api/products/${encodeURIComponent(detection.productId)}`, origin), { headers, signal: AbortSignal.timeout(15000) });
  return response.ok ? (await response.json() as { product: ScoredProduct }).product : null;
}))).filter((product): product is ScoredProduct => Boolean(product));
const ranked = rankPersonalShelfProducts(products);
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(), origin: origin.origin, health, localModelVersion: SHELF_MODEL_VERSION,
  elapsedSeconds: Math.round((Date.now() - started) / 1000), imageStored: false,
  frames: frames.map(({ response }) => ({ requestId: response.requestId, status: response.status, count: response.detections.length })),
  mergedCount: merged.detections.length,
  products: detections.map((detection) => ({ id: detection.productId, name: detection.identity?.name, kind: detection.identity?.matchKind })),
  groups: ranked.groups.map((group) => ({ category: group.category, assessed: group.scoredCount,
    entries: group.entries.map(({ product, assessment, rank }) => ({ id: product.id, name: product.shortName, rank, status: assessment.status, score: assessment.score, range: assessment.scoreRange, missing: assessment.missing })) })),
  unsupported: ranked.unsupported.map(({ product }) => product.id), unresolved: detections.filter((detection) => !products.some((product) => product.id === detection.productId)).map((detection) => detection.productId)
}, null, 2));
