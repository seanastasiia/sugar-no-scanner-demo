import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCatalog } from "../src/lib/catalog";
import { recognizeProducts } from "../src/server/recognition";

interface Options {
  models: string[];
  images: string[];
  repeats: number;
  output: string | null;
}

interface ModelBenchmarkCase {
  caseId: string;
  repeat: number;
  model: string;
  status: string;
  latencyMs: number;
  detectionCount: number;
  distinctIdentities: string[];
}

function parseArgs(argv: string[]): Options {
  let models = ["gemini-3.5-flash", "gemini-3.7-flash"];
  let repeats = 1;
  let output: string | null = null;
  const images: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--models") {
      models = (argv[++index] || "").split(",").map((item) => item.trim()).filter(Boolean);
    } else if (argument === "--repeat") {
      repeats = Number.parseInt(argv[++index] || "", 10);
    } else if (argument === "--output") {
      output = argv[++index] || null;
    } else if (argument.startsWith("-")) {
      throw new Error(`unknown_option:${argument}`);
    } else {
      images.push(path.resolve(argument));
    }
  }
  if (!process.env.GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY is required");
  if (!models.length) throw new Error("at least one model is required");
  if (!images.length) throw new Error("pass one or more JPEG, PNG or WebP images");
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5) throw new Error("--repeat must be 1-5");
  return { models, images, repeats, output: output ? path.resolve(output) : null };
}

function mimeType(filePath: string): "image/jpeg" | "image/png" | "image/webp" {
  const extension = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  throw new Error(`unsupported_image:${extension}`);
}

function percentile(values: number[], ratio: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const catalog = getCatalog();
  const cases: ModelBenchmarkCase[] = [];
  for (const model of options.models) {
    for (let imageIndex = 0; imageIndex < options.images.length; imageIndex += 1) {
      const filePath = options.images[imageIndex];
      const encoded = (await readFile(filePath)).toString("base64");
      for (let repeat = 0; repeat < options.repeats; repeat += 1) {
        const result = await recognizeProducts({
          imageDataUrl: `data:${mimeType(filePath)};base64,${encoded}`,
          source: "upload",
          catalog,
          requestId: `benchmark-${model}-${imageIndex + 1}-${repeat + 1}`,
          deferExternalResolution: true,
          modelOverride: model
        });
        const item = {
          caseId: `case-${imageIndex + 1}`,
          repeat: repeat + 1,
          model,
          status: result.status,
          latencyMs: result.latencyMs,
          detectionCount: result.detections.length,
          distinctIdentities: result.detections.map((detection) =>
            `${detection.identity?.brand || ""} ${detection.identity?.name || detection.observedText}`.trim()
          )
        };
        cases.push(item);
        console.error(`${model} ${item.caseId}: ${item.detectionCount} products in ${item.latencyMs}ms`);
      }
    }
  }
  const summary = options.models.map((model) => {
    const modelCases = cases.filter((item) => item.model === model);
    const latencies = modelCases.map((item) => item.latencyMs);
    return {
      model,
      runs: modelCases.length,
      medianLatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      meanDetectionCount: Number(
        (modelCases.reduce((sum, item) => sum + item.detectionCount, 0) / modelCases.length).toFixed(2)
      )
    };
  });
  const report = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    privacy: { imageBytesWrittenToReport: false, imagePathsIncludedInReport: false },
    summary,
    cases
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) await writeFile(options.output, json, "utf8");
  else process.stdout.write(json);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
