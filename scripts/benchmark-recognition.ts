import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { RecognitionResponse } from "../src/lib/types";
import {
  aggregateRecognitionBenchmark,
  buildRecognitionRequestBody,
  detectBenchmarkImageMime,
  failedRecognitionCase,
  summarizeRecognitionCase,
  type BenchmarkProductDetail,
  type RecognitionBenchmarkCaseResult
} from "../src/lib/recognition-benchmark";

const manifestSchema = z.object({
  cases: z.array(
    z.object({
      id: z.string().min(1).max(80),
      imagePath: z.string().min(1),
      expectedProductIds: z.array(z.string().min(1).max(240)).max(20).optional()
    })
  ).min(1).max(30)
});

interface BenchmarkInputCase {
  id: string;
  imagePath: string;
  expectedProductIds: string[];
}

interface CliOptions {
  endpoint: URL;
  manifestPath: string | null;
  outputPath: string | null;
  timeoutMs: number;
  imagePaths: string[];
}

function usage() {
  return `Usage:
  npm run benchmark:recognition -- --endpoint http://127.0.0.1:3000/api/recognize shelf-1.jpg shelf-2.jpg
  npm run benchmark:recognition -- --endpoint https://example.test/api/recognize --manifest benchmark.json --output report.json

Options:
  --endpoint <url>     Full public/local recognition endpoint (required)
  --manifest <path>   JSON manifest with case id, imagePath and optional expectedProductIds
  --output <path>     Write the metadata-only report; otherwise print it to stdout
  --timeout-ms <ms>   Per-recognition request timeout, default 45000
  --help              Show this help

The harness reads images into memory, posts a transient data URL and never copies or writes image bytes.
Reports contain only case ids and recognition/rating metadata; local image paths are not included.`;
}

function parseArgs(argv: string[]): CliOptions | null {
  if (argv.includes("--help") || argv.includes("-h")) return null;
  let endpointValue = "";
  let manifestPath: string | null = null;
  let outputPath: string | null = null;
  let timeoutMs = 45_000;
  const imagePaths: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--endpoint", "--manifest", "--output", "--timeout-ms"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`missing_value: ${argument}`);
      index += 1;
      if (argument === "--endpoint") endpointValue = value;
      if (argument === "--manifest") manifestPath = value;
      if (argument === "--output") outputPath = value;
      if (argument === "--timeout-ms") timeoutMs = Number.parseInt(value, 10);
      continue;
    }
    if (argument.startsWith("-")) throw new Error(`unknown_option: ${argument}`);
    imagePaths.push(argument);
  }
  if (!endpointValue) throw new Error("missing_endpoint: pass --endpoint with the full /api/recognize URL");
  const endpoint = new URL(endpointValue);
  if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("invalid_endpoint: use an http(s) URL without credentials, query or fragment");
  }
  if (!endpoint.pathname.endsWith("/api/recognize")) {
    throw new Error("invalid_endpoint: URL path must end with /api/recognize");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error("invalid_timeout: use 1000-120000 milliseconds");
  }
  if (manifestPath && imagePaths.length) throw new Error("choose_manifest_or_paths: do not pass both");
  if (!manifestPath && !imagePaths.length) throw new Error("missing_images: pass image paths or --manifest");
  return { endpoint, manifestPath, outputPath, timeoutMs, imagePaths };
}

async function loadCases(options: CliOptions): Promise<BenchmarkInputCase[]> {
  if (!options.manifestPath) {
    return options.imagePaths.map((imagePath, index) => ({
      id: `case-${String(index + 1).padStart(2, "0")}`,
      imagePath: path.resolve(imagePath),
      expectedProductIds: []
    }));
  }
  const manifestPath = path.resolve(options.manifestPath);
  const parsed = manifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  return parsed.cases.map((item) => ({
    id: item.id,
    imagePath: path.resolve(path.dirname(manifestPath), item.imagePath),
    expectedProductIds: [...new Set(item.expectedProductIds || [])]
  }));
}

async function readProductDetail(endpoint: URL, productId: string): Promise<BenchmarkProductDetail | null> {
  const productUrl = new URL(`/api/products/${encodeURIComponent(productId)}`, endpoint);
  const response = await fetch(productUrl, { headers: { accept: "application/json" }, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`product_detail_http_${response.status}`);
  const payload = await response.json() as { product?: BenchmarkProductDetail };
  return payload.product || null;
}

async function benchmarkCase(
  item: BenchmarkInputCase,
  options: CliOptions,
  productCache: Map<string, Promise<BenchmarkProductDetail | null>>
): Promise<RecognitionBenchmarkCaseResult> {
  const startedAt = performance.now();
  let httpStatus = 0;
  try {
    const bytes = await readFile(item.imagePath);
    const mimeType = detectBenchmarkImageMime(bytes);
    if (!mimeType) throw new Error("unsupported_image: expected JPEG, PNG or WebP bytes");
    const body = buildRecognitionRequestBody(bytes, mimeType);
    const response = await fetch(options.endpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs)
    });
    httpStatus = response.status;
    const payload = await response.json() as RecognitionResponse | { error?: string };
    if (!response.ok || !("detections" in payload)) {
      const retryAfter = response.headers.get("retry-after");
      throw new Error(`${"error" in payload && payload.error ? payload.error : `recognition_http_${response.status}`}${retryAfter ? `; retry_after=${retryAfter}s` : ""}`);
    }
    const details = new Map<string, BenchmarkProductDetail | null>();
    for (const productId of [...new Set(payload.detections.map((detection) => detection.productId))]) {
      let pending = productCache.get(productId);
      if (!pending) {
        pending = readProductDetail(options.endpoint, productId).catch(() => null);
        productCache.set(productId, pending);
      }
      details.set(productId, await pending);
    }
    return summarizeRecognitionCase({
      id: item.id,
      httpStatus: response.status,
      roundTripLatencyMs: Math.round(performance.now() - startedAt),
      response: payload,
      expectedProductIds: item.expectedProductIds,
      productDetails: details
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const reportSafeError =
      message.startsWith("ENOENT:")
        ? "image_not_found"
        : message.startsWith("EACCES:")
          ? "image_unreadable"
          : error instanceof Error && error.name === "TimeoutError"
            ? "request_timeout"
            : message;
    return failedRecognitionCase({
      id: item.id,
      httpStatus,
      roundTripLatencyMs: Math.round(performance.now() - startedAt),
      expectedProductIds: item.expectedProductIds,
      error: reportSafeError
    });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    console.log(usage());
    return;
  }
  const inputs = await loadCases(options);
  const productCache = new Map<string, Promise<BenchmarkProductDetail | null>>();
  const cases: RecognitionBenchmarkCaseResult[] = [];
  for (const item of inputs) {
    const result = await benchmarkCase(item, options, productCache);
    cases.push(result);
    console.error(`${result.status === "matched" ? "MATCH" : "CHECK"} ${item.id}: ${result.uniqueProductCount} unique, ${result.ratedProductCount} rated, ${result.roundTripLatencyMs}ms`);
  }
  const report = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    endpointOrigin: options.endpoint.origin,
    privacy: {
      imageBytesWrittenByHarness: false,
      imagePathsIncludedInReport: false,
      imageStorageContractPassed:
        cases.some((item) => item.status !== "request_failed" && item.httpStatus >= 200 && item.httpStatus < 300) &&
        cases
          .filter((item) => item.status !== "request_failed" && item.httpStatus >= 200 && item.httpStatus < 300)
          .every((item) => item.imageStored === false)
    },
    summary: aggregateRecognitionBenchmark(cases),
    cases
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, { encoding: "utf8", flag: "wx" });
    console.error(`Metadata-only report: ${outputPath}`);
  } else {
    process.stdout.write(serialized);
  }
  if (cases.some((item) => item.status === "request_failed")) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
