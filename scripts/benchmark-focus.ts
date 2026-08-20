import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCatalog } from "../src/lib/catalog";
import { recognizeProducts } from "../src/server/recognition";

async function imageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Image returned ${response.status}: ${url}`);
  const contentType = response.headers.get("content-type")?.split(";")[0] || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

async function main() {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY is required for the real focus benchmark");
  }
  const catalog = getCatalog();
  const golden = catalog.filter((product) => product.isGolden && product.imageUrl).slice(0, 10);
  if (golden.length !== 10) throw new Error(`Expected 10 golden images, found ${golden.length}`);

  const cases = [];
  for (const product of golden) {
    const result = await recognizeProducts({
      imageDataUrl: await imageAsDataUrl(product.imageUrl as string),
      source: "upload",
      catalog,
      requestId: crypto.randomUUID()
    });
    const top = [...result.detections].sort((left, right) => right.confidence - left.confidence)[0];
    const correct = top?.productId === product.id;
    cases.push({
      expectedProductId: product.id,
      predictedProductId: top?.productId || null,
      confidence: top?.confidence || null,
      correct,
      latencyMs: result.latencyMs,
      status: result.status,
      model: result.model,
      imageStored: result.imageStored
    });
    console.log(`${correct ? "PASS" : "FAIL"} ${product.id} -> ${top?.productId || result.status}`);
  }

  const accuracy = cases.filter((item) => item.correct).length / cases.length;
  const sortedLatency = cases.map((item) => item.latencyMs).sort((left, right) => left - right);
  const p95LatencyMs = sortedLatency[Math.ceil(sortedLatency.length * 0.95) - 1];
  const report = {
    createdAt: new Date().toISOString(),
    count: cases.length,
    top1Accuracy: accuracy,
    p95LatencyMs,
    threshold: 0.9,
    passed: accuracy >= 0.9,
    note: "Public retailer packshots only; this does not substitute for a physical shelf benchmark.",
    cases
  };
  const outputDirectory = path.resolve("artifacts/benchmarks");
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, `focus-${Date.now()}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Top-1 accuracy: ${(accuracy * 100).toFixed(1)}%`);
  console.log(`p95 latency: ${p95LatencyMs}ms`);
  console.log(`Report: ${outputPath}`);
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
