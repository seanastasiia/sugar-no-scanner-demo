import type { RecognitionResponse } from "@/lib/types";

export const MAX_RECOGNITION_DATA_URL_CHARACTERS = 2_800_000;
export const MAX_RECOGNITION_REQUEST_BYTES = 3_000_000;

export type SupportedBenchmarkImageMime = "image/jpeg" | "image/png" | "image/webp";

export interface BenchmarkProductDetail {
  matchScore: number | null;
  ratingStatus: "complete" | "partial_overall" | "limited_signal" | "identity_only";
  ratingSignalCount: number;
}

export interface RecognitionBenchmarkCaseResult {
  id: string;
  httpStatus: number;
  requestId: string | null;
  status: RecognitionResponse["status"] | "request_failed";
  model: string | null;
  providerLatencyMs: number | null;
  roundTripLatencyMs: number;
  imageStored: false | null;
  detectionCount: number;
  uniqueProductCount: number;
  duplicateCount: number;
  ratedProductCount: number;
  identityKinds: Record<"verified_catalog" | "barbora" | "visual_only" | "unknown", number>;
  ratingStatuses: Record<"complete" | "partial_overall" | "limited_signal" | "identity_only" | "unavailable", number>;
  productIds: string[];
  expectedProductIds: string[];
  missingExpectedProductIds: string[];
  unexpectedProductIds: string[];
  exactIdentityRecall: number | null;
  error: string | null;
}

export function detectBenchmarkImageMime(bytes: Uint8Array): SupportedBenchmarkImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function buildRecognitionRequestBody(bytes: Uint8Array, mimeType: SupportedBenchmarkImageMime): string {
  const imageDataUrl = `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
  if (imageDataUrl.length > MAX_RECOGNITION_DATA_URL_CHARACTERS) {
    throw new Error(
      `image_too_large: encoded image is ${imageDataUrl.length} characters; limit is ${MAX_RECOGNITION_DATA_URL_CHARACTERS}`
    );
  }
  const body = JSON.stringify({ source: "upload", imageDataUrl });
  const requestBytes = Buffer.byteLength(body);
  if (requestBytes > MAX_RECOGNITION_REQUEST_BYTES) {
    throw new Error(
      `request_too_large: JSON body is ${requestBytes} bytes; limit is ${MAX_RECOGNITION_REQUEST_BYTES}`
    );
  }
  return body;
}

function emptyIdentityKinds(): RecognitionBenchmarkCaseResult["identityKinds"] {
  return { verified_catalog: 0, barbora: 0, visual_only: 0, unknown: 0 };
}

function emptyRatingStatuses(): RecognitionBenchmarkCaseResult["ratingStatuses"] {
  return { complete: 0, partial_overall: 0, limited_signal: 0, identity_only: 0, unavailable: 0 };
}

export function summarizeRecognitionCase(input: {
  id: string;
  httpStatus: number;
  roundTripLatencyMs: number;
  response: RecognitionResponse;
  expectedProductIds?: string[];
  productDetails?: Map<string, BenchmarkProductDetail | null>;
}): RecognitionBenchmarkCaseResult {
  if (input.response.imageStored !== false) {
    throw new Error("privacy_contract_failed: recognition response did not confirm imageStored=false");
  }
  const productIds = input.response.detections.map((detection) => detection.productId);
  const uniqueProductIds = [...new Set(productIds)];
  const expectedProductIds = [...new Set(input.expectedProductIds || [])];
  const identityKinds = emptyIdentityKinds();
  const ratingStatuses = emptyRatingStatuses();
  let ratedProductCount = 0;

  for (const detection of input.response.detections) {
    const kind = detection.identity?.matchKind || "unknown";
    identityKinds[kind] += 1;
    const detail = input.productDetails?.get(detection.productId) || null;
    if (!detail) {
      ratingStatuses.unavailable += 1;
      continue;
    }
    ratingStatuses[detail.ratingStatus] += 1;
    if (typeof detail.matchScore === "number" && ["complete", "partial_overall"].includes(detail.ratingStatus)) {
      ratedProductCount += 1;
    }
  }

  const missingExpectedProductIds = expectedProductIds.filter((productId) => !uniqueProductIds.includes(productId));
  const unexpectedProductIds = expectedProductIds.length
    ? uniqueProductIds.filter((productId) => !expectedProductIds.includes(productId))
    : [];
  return {
    id: input.id,
    httpStatus: input.httpStatus,
    requestId: input.response.requestId,
    status: input.response.status,
    model: input.response.model,
    providerLatencyMs: input.response.latencyMs,
    roundTripLatencyMs: input.roundTripLatencyMs,
    imageStored: false,
    detectionCount: productIds.length,
    uniqueProductCount: uniqueProductIds.length,
    duplicateCount: productIds.length - uniqueProductIds.length,
    ratedProductCount,
    identityKinds,
    ratingStatuses,
    productIds: uniqueProductIds,
    expectedProductIds,
    missingExpectedProductIds,
    unexpectedProductIds,
    exactIdentityRecall: expectedProductIds.length
      ? (expectedProductIds.length - missingExpectedProductIds.length) / expectedProductIds.length
      : null,
    error: null
  };
}

export function failedRecognitionCase(input: {
  id: string;
  httpStatus?: number;
  roundTripLatencyMs: number;
  expectedProductIds?: string[];
  error: string;
}): RecognitionBenchmarkCaseResult {
  return {
    id: input.id,
    httpStatus: input.httpStatus || 0,
    requestId: null,
    status: "request_failed",
    model: null,
    providerLatencyMs: null,
    roundTripLatencyMs: input.roundTripLatencyMs,
    imageStored: null,
    detectionCount: 0,
    uniqueProductCount: 0,
    duplicateCount: 0,
    ratedProductCount: 0,
    identityKinds: emptyIdentityKinds(),
    ratingStatuses: emptyRatingStatuses(),
    productIds: [],
    expectedProductIds: [...new Set(input.expectedProductIds || [])],
    missingExpectedProductIds: [...new Set(input.expectedProductIds || [])],
    unexpectedProductIds: [],
    exactIdentityRecall: input.expectedProductIds?.length ? 0 : null,
    error: input.error
  };
}

export function aggregateRecognitionBenchmark(cases: RecognitionBenchmarkCaseResult[]) {
  const expectedCases = cases.filter((item) => item.expectedProductIds.length > 0);
  const expectedProducts = expectedCases.reduce((sum, item) => sum + item.expectedProductIds.length, 0);
  const matchedExpectedProducts = expectedCases.reduce(
    (sum, item) => sum + item.expectedProductIds.length - item.missingExpectedProductIds.length,
    0
  );
  const totalDetections = cases.reduce((sum, item) => sum + item.detectionCount, 0);
  const duplicateCount = cases.reduce((sum, item) => sum + item.duplicateCount, 0);
  const successfulCases = cases.filter(
    (item) => item.status !== "request_failed" && item.httpStatus >= 200 && item.httpStatus < 300
  );
  return {
    caseCount: cases.length,
    successfulCaseCount: successfulCases.length,
    matchedCaseCount: cases.filter((item) => item.status === "matched").length,
    failedCaseCount: cases.filter((item) => item.status === "request_failed").length,
    totalDetections,
    ratedProductCount: cases.reduce((sum, item) => sum + item.ratedProductCount, 0),
    ratedCoverage: totalDetections
      ? cases.reduce((sum, item) => sum + item.ratedProductCount, 0) / totalDetections
      : null,
    duplicateCount,
    duplicateRate: totalDetections ? duplicateCount / totalDetections : 0,
    exactIdentityRecall: expectedProducts ? matchedExpectedProducts / expectedProducts : null,
    unexpectedDetectionCount: cases.reduce((sum, item) => sum + item.unexpectedProductIds.length, 0),
    imageStorageContractPassed:
      successfulCases.length > 0 && successfulCases.every((item) => item.imageStored === false),
    averageProviderLatencyMs: successfulCases.length
      ? Math.round(
          successfulCases.reduce((sum, item) => sum + (item.providerLatencyMs || 0), 0) / successfulCases.length
        )
      : null,
    averageRoundTripLatencyMs: cases.length
      ? Math.round(cases.reduce((sum, item) => sum + item.roundTripLatencyMs, 0) / cases.length)
      : null
  };
}
