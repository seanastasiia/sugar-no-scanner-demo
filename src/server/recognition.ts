import { GoogleGenAI, ThinkingLevel, createPartFromBase64, createPartFromText } from "@google/genai";
import { z } from "zod";
import type { ProductDetection, RecognitionResponse, ScanSource, ScoredProduct } from "@/lib/types";

const providerResponseSchema = z.object({
  detections: z.array(
    z.object({
      productId: z.string(),
      confidence: z.number().min(0).max(1),
      box: z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().min(0).max(1),
        height: z.number().min(0).max(1)
      }),
      observedText: z.string().max(160)
    })
  )
});

const sampleShelf: ProductDetection[] = [
  {
    productId: "prot-bat-sal-riekst-saldin-barebells-55-g",
    confidence: 0.98,
    box: { x: 0.05, y: 0.17, width: 0.2, height: 0.65 },
    observedText: "Barebells Salty Peanut"
  },
  {
    productId: "prot-bat-barebells-lemon-cheesecake-55-g",
    confidence: 0.97,
    box: { x: 0.28, y: 0.17, width: 0.2, height: 0.65 },
    observedText: "Barebells Lemon Cheesecake"
  },
  {
    productId: "proteina-bat-cepuma-garsa-iconfit-55-g",
    confidence: 0.96,
    box: { x: 0.52, y: 0.17, width: 0.2, height: 0.65 },
    observedText: "ICONFIT Cookie Bliss"
  },
  {
    productId: "protein-baton-sal-kar-the-beginnings-50-g",
    confidence: 0.95,
    box: { x: 0.75, y: 0.17, width: 0.2, height: 0.65 },
    observedText: "The Beginnings Salty Caramel"
  }
];

const conveyorIds = [
  "prot-bat-sal-riekst-saldin-barebells-55-g",
  "proteina-baton-barebells-chokladboll-55-g",
  "proteina-bat-sok-karamelu-iconfit-55-g",
  "prot-bat-van-bez-cuk-the-beginnings-50-g"
];

function sampleResponse(source: ScanSource, sampleFrame = 0): ProductDetection[] | null {
  if (source === "sample-shelf") return sampleShelf;
  if (source !== "sample-conveyor") return null;
  const productId = conveyorIds[Math.abs(sampleFrame) % conveyorIds.length];
  return [
    {
      productId,
      confidence: 0.97,
      box: { x: 0.34, y: 0.2, width: 0.32, height: 0.62 },
      observedText: productId.replaceAll("-", " ")
    }
  ];
}

function imageParts(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("unsupported_image");
  return { mimeType: match[1], base64: match[2] };
}

export function fitBoxToFrame(box: ProductDetection["box"]): ProductDetection["box"] {
  const x = Math.min(1, Math.max(0, box.x));
  const y = Math.min(1, Math.max(0, box.y));
  return {
    x,
    y,
    width: Math.max(0, Math.min(box.width, 1 - x)),
    height: Math.max(0, Math.min(box.height, 1 - y))
  };
}

export async function recognizeProducts(input: {
  imageDataUrl?: string;
  source: ScanSource;
  sampleFrame?: number;
  catalog: ScoredProduct[];
  requestId: string;
}): Promise<RecognitionResponse> {
  const startedAt = performance.now();
  const sample = sampleResponse(input.source, input.sampleFrame);
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  if (sample) {
    return {
      requestId: input.requestId,
      status: "matched",
      detections: sample,
      latencyMs: Math.round(performance.now() - startedAt),
      model: "deterministic-sample-v1",
      imageStored: false
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !input.imageDataUrl) {
    return {
      requestId: input.requestId,
      status: "provider_unavailable",
      detections: [],
      latencyMs: Math.round(performance.now() - startedAt),
      model,
      imageStored: false
    };
  }

  const threshold = Number.parseFloat(process.env.RECOGNITION_CONFIDENCE_THRESHOLD || "0.82");
  const allowedIds = new Set(input.catalog.map((product) => product.id));
  const compactCatalog = input.catalog.map((product) => ({
    id: product.id,
    brand: product.brand,
    name: product.name,
    aliases: product.aliases
  }));
  const { mimeType, base64 } = imageParts(input.imageDataUrl);
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [
      createPartFromText(
        `Identify only clearly visible packaged products from this closed Latvia catalog. ` +
          `Never invent an ID. Return an empty detections array when unsure. ` +
          `Boxes use x, y, width and height normalized from 0 to 1. Catalog: ${JSON.stringify(compactCatalog)}`
      ),
      createPartFromBase64(base64, mimeType)
    ],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["detections"],
        properties: {
          detections: {
            type: "array",
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["productId", "confidence", "box", "observedText"],
              properties: {
                productId: { type: "string", enum: [...allowedIds] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                observedText: { type: "string", maxLength: 160 },
                box: {
                  type: "object",
                  additionalProperties: false,
                  required: ["x", "y", "width", "height"],
                  properties: {
                    x: { type: "number", minimum: 0, maximum: 1 },
                    y: { type: "number", minimum: 0, maximum: 1 },
                    width: { type: "number", minimum: 0, maximum: 1 },
                    height: { type: "number", minimum: 0, maximum: 1 }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  const parsed = providerResponseSchema.parse(JSON.parse(response.text || '{"detections":[]}'));
  const detections = parsed.detections
    .filter((detection) => detection.confidence >= threshold && allowedIds.has(detection.productId))
    .map((detection) => ({ ...detection, box: fitBoxToFrame(detection.box) }))
    .filter((detection) => detection.box.width >= 0.02 && detection.box.height >= 0.02);

  return {
    requestId: input.requestId,
    status: detections.length ? "matched" : "not_sure",
    detections,
    latencyMs: Math.round(performance.now() - startedAt),
    model,
    imageStored: false
  };
}
