"use client";

import Image from "next/image";
import {
  ArrowUpRight,
  ArrowDown,
  Camera,
  Check,
  ChevronDown,
  CircleAlert,
  FileImage,
  Info,
  Layers3,
  LoaderCircle,
  List,
  Minus,
  RefreshCw,
  ScanLine,
  ShoppingBasket,
  X
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAMERA_FOCUS_CROP,
  mapBoxToObjectContain,
  mapBoxToObjectCover,
  remapRecognitionFromCrop,
  type MediaDimensions
} from "@/lib/camera-focus";
import {
  globalBestProductId,
  matchCriteria,
  overlayMatchPresentation,
  rankScanProductIds,
  type MatchTone,
  type SignalCompleteness
} from "@/lib/match-presentation";
import { dedupeProductDetections } from "@/lib/product-detection-dedupe";
import { displayableScanProductIds, hasSugarNoRating, ratedScanProductIds } from "@/lib/rating-visibility";
import { barboraProductSlug, isExactOnlineSaving } from "@/lib/online-offer";
import {
  mapWithConcurrency,
  mergeEnrichedDetections,
  mergeProgressiveEnrichment
} from "@/lib/product-enrichment";
import { MAX_SCAN_PRODUCTS } from "@/lib/scan-limits";
import { compareFairCohorts } from "@/lib/scoring";
import { mergeUploadScanResults, uploadScanCrops, type UploadScanCrop } from "@/lib/upload-scan";
import type {
  ProductDetection,
  RetailerOffer,
  RecognitionEnrichmentResponse,
  RecognitionMode,
  RecognitionResponse,
  RecognizedProductIdentity,
  ScanSource,
  ScoredProduct
} from "@/lib/types";
import styles from "./scanner-app.module.css";

interface ProductPayload {
  product: ScoredProduct;
  alternatives: ScoredProduct[];
}

interface AlternativeOfferResponse {
  offers: Record<string, RetailerOffer | null>;
}

type CameraState = "idle" | "requesting" | "live" | "denied" | "error";
type RecognitionState = "idle" | "scanning" | "matched" | "retained" | "not_sure" | "unavailable" | "rate_limited" | "error";

const shelfIds = [
  "prot-bat-sal-riekst-saldin-barebells-55-g",
  "prot-bat-barebells-lemon-cheesecake-55-g",
  "proteina-bat-cepuma-garsa-iconfit-55-g",
  "proteina-baton-barebells-coco-choco-55-g"
];

function makeSessionId() {
  return crypto.randomUUID();
}

function retryAfterSeconds(value: string | null): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 30;
}

interface PreparedUploadFrame {
  crop: UploadScanCrop;
  imageDataUrl: string;
}

function imageCropToDataUrl(image: HTMLImageElement, crop: UploadScanCrop): string {
  const sourceWidth = image.naturalWidth * crop.width;
  const sourceHeight = image.naturalHeight * crop.height;
  let scale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight));
  let dataUrl = "";
  do {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas is unavailable");
    context.drawImage(
      image,
      image.naturalWidth * crop.x,
      image.naturalHeight * crop.y,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    scale *= 0.8;
  } while (dataUrl.length > 2_650_000 && scale > 0.25);
  if (dataUrl.length > 2_650_000) throw new Error("Image remains too large after resizing");
  return dataUrl;
}

async function imageFileToScanFrames(file: File): Promise<PreparedUploadFrame[]> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = document.createElement("img");
    image.decoding = "async";
    image.src = sourceUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image could not be decoded"));
    });

    return uploadScanCrops(image.naturalWidth, image.naturalHeight).map((crop) => ({
      crop,
      imageDataUrl: imageCropToDataUrl(image, crop)
    }));
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function loadScanImage(sourceUrl: string): Promise<HTMLImageElement> {
  const image = document.createElement("img");
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Scan image could not be decoded"));
    image.src = sourceUrl;
  });
  await image.decode();
  return image;
}

function detectionCropToDataUrl(image: HTMLImageElement, detection: ProductDetection): string | null {
  const paddingX = Math.max(0.018, detection.box.width * 0.08);
  const paddingY = Math.max(0.018, detection.box.height * 0.06);
  const x = Math.max(0, detection.box.x - paddingX);
  const y = Math.max(0, detection.box.y - paddingY);
  const right = Math.min(1, detection.box.x + detection.box.width + paddingX);
  const bottom = Math.min(1, detection.box.y + detection.box.height + paddingY);
  const sourceWidth = (right - x) * image.naturalWidth;
  const sourceHeight = (bottom - y) * image.naturalHeight;
  if (sourceWidth < 2 || sourceHeight < 2) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 240;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#f5f5f7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
  const targetWidth = sourceWidth * scale;
  const targetHeight = sourceHeight * scale;
  context.drawImage(
    image,
    x * image.naturalWidth,
    y * image.naturalHeight,
    sourceWidth,
    sourceHeight,
    (canvas.width - targetWidth) / 2,
    (canvas.height - targetHeight) / 2,
    targetWidth,
    targetHeight
  );
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function cropDetectionThumbnails(
  sourceUrl: string,
  detections: ProductDetection[]
): Promise<Record<string, string>> {
  const image = await loadScanImage(sourceUrl);
  return Object.fromEntries(
    detections.flatMap((detection) => {
      const cropUrl = detectionCropToDataUrl(image, detection);
      return cropUrl ? [[detection.productId, cropUrl]] : [];
    })
  );
}

function ProductThumbnail({
  primaryUrl,
  fallbackUrl,
  sizes
}: {
  primaryUrl: string | null | undefined;
  fallbackUrl: string | null | undefined;
  sizes: string;
}) {
  const [activeUrl, setActiveUrl] = useState(primaryUrl || fallbackUrl || null);

  if (!activeUrl) return null;
  return (
    <Image
      src={activeUrl}
      alt=""
      fill
      sizes={sizes}
      unoptimized={activeUrl.startsWith("data:")}
      onError={() => setActiveUrl(activeUrl === primaryUrl ? fallbackUrl || null : null)}
    />
  );
}

function sourceLabel(source: ScanSource) {
  if (source === "sample-conveyor") return "Checkout photo";
  if (source === "sample-shelf") return "Shelf photo";
  if (source === "upload") return "Saved shelf or checkout photo";
  return "Live camera";
}

function toneClass(tone: MatchTone) {
  if (tone === "strong") return styles.toneStrong;
  if (tone === "middle") return styles.toneMiddle;
  if (tone === "lower") return styles.toneLower;
  return styles.tonePending;
}

function OverlayToneIcon({ tone }: { tone: MatchTone }) {
  if (tone === "strong") return <Check aria-hidden="true" size={22} strokeWidth={3} />;
  if (tone === "middle") return <Minus aria-hidden="true" size={22} strokeWidth={3} />;
  if (tone === "lower") return <ArrowDown aria-hidden="true" size={21} strokeWidth={2.6} />;
  return <ScanLine aria-hidden="true" size={20} strokeWidth={2.5} />;
}

function completenessClass(completeness: SignalCompleteness) {
  if (completeness === "full") return styles.completenessFull;
  if (completeness === "partial") return styles.completenessPartial;
  if (completeness === "limited") return styles.completenessLimited;
  return styles.completenessIdentified;
}

function trapFocus(event: KeyboardEvent, container: HTMLElement) {
  if (event.key !== "Tab") return;
  const focusable = [...container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.hasAttribute("inert") && element.offsetParent !== null);
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function ScannerApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanKickoffRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const recognitionAbortRef = useRef<AbortController | null>(null);
  const enrichmentAbortRef = useRef<AbortController | null>(null);
  const lowResFrameRef = useRef<Uint8ClampedArray | null>(null);
  const focusRetryRef = useRef(false);
  const shelfCompletionRetryRef = useRef(false);
  const provisionalResponseRef = useRef<RecognitionResponse | null>(null);
  const lastCaptureRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const resultsSheetRef = useRef<HTMLElement>(null);
  const demoDialogRef = useRef<HTMLDivElement>(null);
  const demoTriggerRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const manualSelectionRef = useRef(false);
  const cameraRequestRef = useRef(0);
  const productFetchesRef = useRef(new Set<string>());
  const nutritionTargetRef = useRef<RecognizedProductIdentity | null>(null);
  const nutritionReturnRef = useRef<{
    targetProductId: string;
    detections: ProductDetection[];
    tray: string[];
  } | null>(null);

  const [source, setSource] = useState<ScanSource>("camera");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [recognitionState, setRecognitionState] = useState<RecognitionState>("idle");
  const [scanMode, setScanMode] = useState<RecognitionMode>("products");
  const [detections, setDetections] = useState<ProductDetection[]>([]);
  const [tray, setTray] = useState<string[]>([]);
  const [products, setProducts] = useState<Record<string, ProductPayload>>({});
  const [loadingProductIds, setLoadingProductIds] = useState<string[]>([]);
  const [enrichingProductIds, setEnrichingProductIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null);
  const [thumbnailResult, setThumbnailResult] = useState<{
    sourceUrl: string;
    thumbnails: Record<string, string>;
    revision: number;
  }>({ sourceUrl: "", thumbnails: {}, revision: 0 });
  const [statusMessage, setStatusMessage] = useState("Ready when you are");
  const [resultLocked, setResultLocked] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [stageDimensions, setStageDimensions] = useState<MediaDimensions | null>(null);
  const [mediaDimensions, setMediaDimensions] = useState<MediaDimensions | null>(null);
  const [networkOnline, setNetworkOnline] = useState(true);

  const ensureSession = useCallback(() => {
    if (!sessionIdRef.current) sessionIdRef.current = makeSessionId();
    return sessionIdRef.current;
  }, []);

  const track = useCallback(
    (
      name:
        | "scan_started"
        | "scan_completed"
        | "result_opened"
        | "alternative_viewed"
        | "retailer_link_clicked"
        | "permission_denied"
        | "recognition_failed",
      eventSource: ScanSource,
      productId?: string,
      metadata: Record<string, string | number | boolean | null> = {}
    ) => {
      void fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: ensureSession(),
          name,
          source: eventSource,
          productId: productId || null,
          metadata
        }),
        keepalive: true
      }).catch(() => undefined);
    },
    [ensureSession]
  );

  const hydrateProducts = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids)].filter((id) => !productFetchesRef.current.has(id));
    if (!uniqueIds.length) return;
    uniqueIds.forEach((id) => productFetchesRef.current.add(id));
    setLoadingProductIds([...productFetchesRef.current]);
    try {
      const entries = await Promise.all(
        uniqueIds.map(async (id) => {
          const response = await fetch(`/api/products/${encodeURIComponent(id)}`);
          if (!response.ok) return null;
          return [id, (await response.json()) as ProductPayload] as const;
        })
      );
      setProducts((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)))
      }));
    } finally {
      uniqueIds.forEach((id) => productFetchesRef.current.delete(id));
      setLoadingProductIds([...productFetchesRef.current]);
    }
  }, []);

  const enrichRecognizedProducts = useCallback(
    async (initialDetections: ProductDetection[], requestRevision: number) => {
      enrichmentAbortRef.current?.abort();
      const controller = new AbortController();
      enrichmentAbortRef.current = controller;
      setEnrichingProductIds(initialDetections.map((detection) => detection.productId));
      try {
        await mapWithConcurrency(initialDetections, 5, async (initialDetection) => {
          try {
            const response = await fetch("/api/resolve-products", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ detections: [initialDetection] }),
              signal: controller.signal
            });
            if (!response.ok || controller.signal.aborted || requestRevision !== cameraRequestRef.current) return;
            const result = (await response.json()) as RecognitionEnrichmentResponse;
            if (controller.signal.aborted || requestRevision !== cameraRequestRef.current || !result.detections.length) return;
            const enrichedDetection = mergeEnrichedDetections([initialDetection], result.detections)[0];
            if (!enrichedDetection) return;
            if (enrichedDetection.inlineProduct) {
              setProducts((current) => ({
                ...current,
                [enrichedDetection.productId]: {
                  product: enrichedDetection.inlineProduct!,
                  alternatives: [] as ScoredProduct[]
                }
              }));
            }
            setDetections((current) =>
              dedupeProductDetections(
                mergeProgressiveEnrichment(current, initialDetection, result.detections[0])
              ).slice(0, MAX_SCAN_PRODUCTS)
            );
            setTray((current) => [
              ...new Set(
                current.map((id) =>
                  id === initialDetection.productId ? enrichedDetection.productId : id
                )
              )
            ]);
            setSelectedId((current) =>
              current === initialDetection.productId ? enrichedDetection.productId : current
            );
            const catalogId = enrichedDetection.inlineProduct
              ? null
              : enrichedDetection.catalogProductId ||
                (["barbora", "open_food_facts"].includes(enrichedDetection.identity?.matchKind || "")
                  ? enrichedDetection.productId
                  : null);
            if (catalogId) void hydrateProducts([catalogId]);
          } finally {
            setEnrichingProductIds((current) =>
              current.filter((id) => id !== initialDetection.productId)
            );
          }
        });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        // The fast recognition result remains useful if optional retailer enrichment fails.
      } finally {
        if (enrichmentAbortRef.current === controller) {
          enrichmentAbortRef.current = null;
          setEnrichingProductIds([]);
        }
      }
    },
    [hydrateProducts]
  );

  const pauseRecognitionLoop = useCallback(() => {
    if (scanKickoffRef.current) clearTimeout(scanKickoffRef.current);
    scanKickoffRef.current = null;
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    videoRef.current?.pause();
  }, []);

  const applyRecognition = useCallback(
    (result: RecognitionResponse, eventSource: ScanSource, focusMode = false, nutritionMode = false) => {
      if (result.status === "provider_unavailable") {
        const provisional = provisionalResponseRef.current;
        pauseRecognitionLoop();
        shelfCompletionRetryRef.current = false;
        setRecognitionState("unavailable");
        setResultLocked(Boolean(provisional));
        setStatusMessage(
          provisional
            ? "Recognition is unavailable. 1 product found from the last frame — try again or open the demo."
            : "Recognition is unavailable — try again or open the demo."
        );
        return;
      }
      if (result.status !== "matched" || result.detections.length === 0) {
        if (nutritionMode) {
          setRecognitionState("not_sure");
          setStatusMessage("Could not read the full table — fill the frame with per 100 g/ml, kcal, protein and sugars");
        } else if (eventSource === "camera" && shelfCompletionRetryRef.current) {
          const provisional = provisionalResponseRef.current;
          shelfCompletionRetryRef.current = false;
          provisionalResponseRef.current = null;
          pauseRecognitionLoop();
          if (provisional) {
            const provisionalDetections = dedupeProductDetections(provisional.detections).slice(0, MAX_SCAN_PRODUCTS);
            const provisionalIds = provisionalDetections.map((detection) => detection.productId);
            setDetections(provisionalDetections);
            setTray(provisionalIds);
            setSelectedId(provisionalIds[0] || null);
            setResultLocked(true);
            setRecognitionState("retained");
            setStatusMessage("1 product found");
            track("scan_completed", eventSource, provisionalIds[0], {
              count: provisionalIds.length,
              latencyMs: provisional.latencyMs,
              model: provisional.model,
              completionRetry: true
            });
            return;
          }
          setResultLocked(true);
          setRecognitionState("not_sure");
          setStatusMessage("Could not confirm the shelf — scan again");
        } else if (eventSource === "camera" && !focusMode) {
          focusRetryRef.current = true;
          lastCaptureRef.current = 0;
          setRecognitionState("scanning");
          setStatusMessage("Trying a closer center read…");
        } else {
          setRecognitionState("not_sure");
          setStatusMessage(
            eventSource === "camera" ? "Not sure — center one package" : "Not sure — use a clearer package photo"
          );
        }
        setDetections([]);
        setTray([]);
        setSelectedId(null);
        return;
      }
      focusRetryRef.current = false;
      const uniqueDetections = dedupeProductDetections(result.detections).slice(0, MAX_SCAN_PRODUCTS);
      const nutritionReturn = nutritionMode ? nutritionReturnRef.current : null;
      const returnedNutritionDetection = nutritionReturn ? uniqueDetections[0] : null;
      const presentedDetections =
        nutritionReturn && returnedNutritionDetection
          ? nutritionReturn.detections.map((detection) =>
              detection.productId === nutritionReturn.targetProductId
                ? {
                    ...returnedNutritionDetection,
                    shelfPrice: detection.shelfPrice,
                    retailerOffer: detection.retailerOffer
                  }
                : detection
            )
          : uniqueDetections;
      const inlineEntries: Array<[string, ProductPayload]> = uniqueDetections.flatMap((detection) =>
        detection.inlineProduct
          ? [[detection.productId, { product: detection.inlineProduct, alternatives: [] as ScoredProduct[] }]]
          : []
      );
      if (inlineEntries.length) {
        setProducts((current) => ({ ...current, ...Object.fromEntries(inlineEntries) }));
      }
      const needsShelfCompletionRetry =
        !nutritionMode &&
        eventSource === "camera" &&
        !focusMode &&
        uniqueDetections.length === 1 &&
        !shelfCompletionRetryRef.current;
      setRecognitionState(needsShelfCompletionRetry ? "scanning" : "matched");
      setDetections(presentedDetections);
      const ids =
        nutritionReturn && returnedNutritionDetection
          ? nutritionReturn.tray.map((id) =>
              id === nutritionReturn.targetProductId ? returnedNutritionDetection.productId : id
            )
          : uniqueDetections.map((detection) => detection.productId);
      const catalogIds = uniqueDetections
        .map(
          (detection) =>
            detection.catalogProductId ||
            (["barbora", "open_food_facts"].includes(detection.identity?.matchKind || "")
              ? detection.productId
              : null) ||
            (detection.identity ? null : detection.productId)
        )
        .filter((id) => !uniqueDetections.some((detection) => detection.productId === id && detection.inlineProduct))
        .filter((id): id is string => Boolean(id));
      if (needsShelfCompletionRetry) {
        shelfCompletionRetryRef.current = true;
        provisionalResponseRef.current = { ...result, detections: uniqueDetections };
        setResultLocked(false);
        setResultsExpanded(false);
        setStatusMessage("1 product found. Scanning the rest of the shelf…");
        setTray(ids);
        manualSelectionRef.current = false;
        setSelectedId(ids[0] || null);
        lastCaptureRef.current = 0;
        void hydrateProducts(catalogIds);
        return;
      }
      shelfCompletionRetryRef.current = false;
      provisionalResponseRef.current = null;
      if (nutritionMode) {
        nutritionTargetRef.current = null;
        nutritionReturnRef.current = null;
      }
      if (eventSource === "camera") {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
        videoRef.current?.pause();
        setResultLocked(true);
      }
      setResultsExpanded(eventSource === "upload" && ids.length > 1);
      setStatusMessage(nutritionMode ? "Nutrition label read. Building Sugar.no fit…" : "Products found. Checking Sugar.no signals…");
      setTray(ids);
      manualSelectionRef.current = false;
      setSelectedId(ids[0] || null);
      void hydrateProducts(catalogIds);
      track("scan_completed", eventSource, ids[0], {
        count: ids.length,
        latencyMs: result.latencyMs,
        model: result.model,
        mode: nutritionMode ? "nutrition-label" : "products",
        minConfidence: Math.min(...uniqueDetections.map((detection) => detection.confidence)),
        meanConfidence:
          uniqueDetections.reduce((sum, detection) => sum + detection.confidence, 0) /
          uniqueDetections.length
      });
      if (["camera", "upload"].includes(eventSource) && !nutritionMode) {
        void enrichRecognizedProducts(uniqueDetections, cameraRequestRef.current);
      }
    },
    [enrichRecognizedProducts, hydrateProducts, pauseRecognitionLoop, track]
  );

  const recognize = useCallback(
    async (payload: {
      source: ScanSource;
      imageDataUrl?: string;
      sampleFrame?: number;
      focusMode?: boolean;
      mode?: RecognitionMode;
      targetIdentity?: RecognizedProductIdentity;
    }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const controller = new AbortController();
      recognitionAbortRef.current = controller;
      setRecognitionState("scanning");
      setStatusMessage(
        payload.mode === "nutrition-label" ? "Reading protein and sugars from the nutrition table…" : "Reading visible products…"
      );
      try {
        const response = await fetch("/api/recognize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        if (controller.signal.aborted) return;
        if (response.status === 429) {
          const retrySeconds = retryAfterSeconds(response.headers.get("retry-after"));
          pauseRecognitionLoop();
          shelfCompletionRetryRef.current = false;
          setResultLocked(Boolean(provisionalResponseRef.current));
          setRecognitionState("rate_limited");
          setStatusMessage(`Scanning paused. Try again in ${retrySeconds}s or open the demo.`);
          track("recognition_failed", payload.source, undefined, {
            message: "rate_limited",
            retryAfterSeconds: retrySeconds
          });
          return;
        }
        if (!response.ok) throw new Error(`Recognition returned ${response.status}`);
        const result = (await response.json()) as RecognitionResponse;
        if (controller.signal.aborted) return;
        applyRecognition(
          payload.focusMode ? remapRecognitionFromCrop(result) : result,
          payload.source,
          Boolean(payload.focusMode),
          payload.mode === "nutrition-label"
        );
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        pauseRecognitionLoop();
        shelfCompletionRetryRef.current = false;
        setResultLocked(Boolean(provisionalResponseRef.current));
        setRecognitionState("error");
        setStatusMessage("The scan paused. Try again.");
        track("recognition_failed", payload.source, undefined, {
          message: error instanceof Error ? error.message : "unknown"
        });
      } finally {
        if (recognitionAbortRef.current === controller) {
          recognitionAbortRef.current = null;
          inFlightRef.current = false;
        }
      }
    },
    [applyRecognition, pauseRecognitionLoop, track]
  );

  const recognizeUploadFrames = useCallback(
    async (frames: PreparedUploadFrame[]) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const controller = new AbortController();
      recognitionAbortRef.current = controller;
      const startedAt = performance.now();
      setRecognitionState("scanning");
      setStatusMessage(
        frames.length > 1 ? "Reading the full image and close-up sections…" : "Reading visible products…"
      );
      try {
        const outcomes = await Promise.all(
          frames.map(async (frame) => {
            try {
              const response = await fetch("/api/recognize", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ source: "upload", imageDataUrl: frame.imageDataUrl }),
                signal: controller.signal
              });
              if (controller.signal.aborted) return { kind: "cancelled" as const };
              if (response.status === 429) {
                return {
                  kind: "rate_limited" as const,
                  retrySeconds: retryAfterSeconds(response.headers.get("retry-after"))
                };
              }
              if (!response.ok) return { kind: "error" as const, status: response.status };
              return {
                kind: "success" as const,
                crop: frame.crop,
                response: (await response.json()) as RecognitionResponse
              };
            } catch {
              if (controller.signal.aborted) return { kind: "cancelled" as const };
              return { kind: "error" as const, status: 0 };
            }
          })
        );
        if (controller.signal.aborted) return;
        const successful = outcomes.flatMap((outcome) =>
          outcome.kind === "success" ? [{ crop: outcome.crop, response: outcome.response }] : []
        );
        if (!successful.length) {
          const limited = outcomes.find((outcome) => outcome.kind === "rate_limited");
          pauseRecognitionLoop();
          setRecognitionState(limited ? "rate_limited" : "error");
          setStatusMessage(
            limited
              ? `Scanning paused. Try again in ${limited.retrySeconds}s or open the demo.`
              : "The scan paused. Try again."
          );
          track("recognition_failed", "upload", undefined, {
            message: limited ? "rate_limited" : "upload_multi_pass_failed",
            frameCount: frames.length
          });
          return;
        }
        const merged = mergeUploadScanResults(successful);
        applyRecognition(
          { ...merged, latencyMs: Math.round(performance.now() - startedAt) },
          "upload"
        );
      } finally {
        if (recognitionAbortRef.current === controller) {
          recognitionAbortRef.current = null;
          inFlightRef.current = false;
        }
      }
    },
    [applyRecognition, pauseRecognitionLoop, track]
  );

  const stopActiveCapture = useCallback(() => {
    cameraRequestRef.current += 1;
    recognitionAbortRef.current?.abort();
    recognitionAbortRef.current = null;
    enrichmentAbortRef.current?.abort();
    enrichmentAbortRef.current = null;
    setEnrichingProductIds([]);
    inFlightRef.current = false;
    if (scanKickoffRef.current) clearTimeout(scanKickoffRef.current);
    scanKickoffRef.current = null;
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    streamRef.current?.getTracks().forEach((trackItem) => trackItem.stop());
    streamRef.current = null;
    lowResFrameRef.current = null;
    focusRetryRef.current = false;
    shelfCompletionRetryRef.current = false;
    provisionalResponseRef.current = null;
    nutritionTargetRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const captureStableFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || inFlightRef.current) return;
    const lowCanvas = document.createElement("canvas");
    lowCanvas.width = 64;
    lowCanvas.height = 48;
    const lowContext = lowCanvas.getContext("2d", { willReadFrequently: true });
    if (!lowContext) return;
    lowContext.drawImage(video, 0, 0, 64, 48);
    const current = lowContext.getImageData(0, 0, 64, 48).data;
    const previous = lowResFrameRef.current;
    lowResFrameRef.current = new Uint8ClampedArray(current);
    let difference = 0;
    if (previous) {
      for (let index = 0; index < current.length; index += 16) {
        difference += Math.abs(current[index] - previous[index]);
      }
      difference /= current.length / 16;
    }
    const now = Date.now();
    const stableEnough = !previous || difference < 11;
    if (!stableEnough || now - lastCaptureRef.current < 2_100) return;
    lastCaptureRef.current = now;

    const canvas = document.createElement("canvas");
    const sourceWidth = video.videoWidth || 960;
    const sourceHeight = video.videoHeight || 1280;
    const nutritionTarget = nutritionTargetRef.current;
    const focusMode = !nutritionTarget && focusRetryRef.current;
    const crop = focusMode ? CAMERA_FOCUS_CROP : { x: 0, y: 0, width: 1, height: 1 };
    const targetWidth = Math.min(sourceWidth * crop.width, 1280);
    canvas.width = targetWidth;
    canvas.height = Math.round(targetWidth * ((sourceHeight * crop.height) / (sourceWidth * crop.width)));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(
      video,
      sourceWidth * crop.x,
      sourceHeight * crop.y,
      sourceWidth * crop.width,
      sourceHeight * crop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.76);
    if (!focusMode && !nutritionTarget) setScanImageUrl(imageDataUrl);
    void recognize({
      source: "camera",
      imageDataUrl,
      focusMode,
      mode: nutritionTarget ? "nutrition-label" : "products",
      targetIdentity: nutritionTarget || undefined
    });
  }, [recognize]);

  const requestCamera = useCallback(async (nutritionTarget: RecognizedProductIdentity | null) => {
    sessionIdRef.current = makeSessionId();
    stopActiveCapture();
    nutritionTargetRef.current = nutritionTarget;
    if (!nutritionTarget) nutritionReturnRef.current = null;
    const requestId = cameraRequestRef.current;
    setSource("camera");
    setScanMode(nutritionTarget ? "nutrition-label" : "products");
    setPreviewUrl(null);
    if (!nutritionTarget) setScanImageUrl(null);
    setCameraState("requesting");
    setDetections([]);
    setTray([]);
    setSelectedId(null);
    manualSelectionRef.current = false;
    setResultLocked(false);
    setResultsExpanded(false);
    setDemoOpen(false);
    setMediaDimensions(null);
    focusRetryRef.current = false;
    shelfCompletionRetryRef.current = false;
    provisionalResponseRef.current = null;
    setStatusMessage("Waiting for camera permission…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1920 }
        },
        audio: false
      });
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((trackItem) => trackItem.stop());
        return;
      }
      streamRef.current = stream;
      for (let attempt = 0; attempt < 10 && !videoRef.current; attempt += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      if (!videoRef.current) throw new Error("Camera preview is not ready");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraState("live");
      setRecognitionState("idle");
      setStatusMessage(
        nutritionTarget
          ? "Turn the pack around and fill the frame with the nutrition table"
          : "Point at several products and hold steady"
      );
      track("scan_started", "camera");
      lastCaptureRef.current = 0;
      scanKickoffRef.current = setTimeout(captureStableFrame, 120);
      scanTimerRef.current = setInterval(captureStableFrame, 450);
    } catch (error) {
      const denied = error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name);
      setCameraState(denied ? "denied" : "error");
      setStatusMessage(
        denied
          ? "Allow camera access in Safari settings, then tap Enable camera."
          : "Camera could not start. You can retry or open the demo."
      );
      if (denied) track("permission_denied", "camera");
    }
  }, [captureStableFrame, stopActiveCapture, track]);

  const startCamera = useCallback(() => requestCamera(null), [requestCamera]);

  const scanAgain = useCallback(() => {
    if (source !== "camera") return;
    sessionIdRef.current = makeSessionId();
    cameraRequestRef.current += 1;
    enrichmentAbortRef.current?.abort();
    enrichmentAbortRef.current = null;
    setEnrichingProductIds([]);
    if (scanKickoffRef.current) clearTimeout(scanKickoffRef.current);
    scanKickoffRef.current = null;
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    lowResFrameRef.current = null;
    const nutritionTarget = nutritionTargetRef.current;
    focusRetryRef.current = false;
    shelfCompletionRetryRef.current = false;
    provisionalResponseRef.current = null;
    lastCaptureRef.current = 0;
    setDetections([]);
    if (!nutritionTarget) setScanImageUrl(null);
    setTray([]);
    setSelectedId(null);
    manualSelectionRef.current = false;
    setRecognitionState("idle");
    setResultLocked(false);
    setResultsExpanded(false);
    setStatusMessage(
      nutritionTarget
        ? "Turn the pack around and fill the frame with the nutrition table"
        : "Point at several products and hold steady"
    );
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      void startCamera();
      return;
    }
    void video
      .play()
      .then(() => {
        track("scan_started", "camera");
        scanKickoffRef.current = setTimeout(captureStableFrame, 120);
        scanTimerRef.current = setInterval(captureStableFrame, 450);
      })
      .catch(() => void startCamera());
  }, [captureStableFrame, source, startCamera, track]);

  const startShelf = useCallback(() => {
    sessionIdRef.current = makeSessionId();
    stopActiveCapture();
    setSource("sample-shelf");
    nutritionReturnRef.current = null;
    setScanMode("products");
    setPreviewUrl(null);
    setScanImageUrl("/samples/latvia-shelf.jpg");
    setMediaDimensions(null);
    setCameraState("idle");
    setDetections([]);
    setTray([]);
    setSelectedId(null);
    manualSelectionRef.current = false;
    setResultLocked(false);
    setResultsExpanded(false);
    setDemoOpen(false);
    track("scan_started", "sample-shelf");
    void hydrateProducts(shelfIds);
    void recognize({ source: "sample-shelf" });
  }, [hydrateProducts, recognize, stopActiveCapture, track]);

  const startCheckout = useCallback(() => {
    sessionIdRef.current = makeSessionId();
    stopActiveCapture();
    setSource("sample-conveyor");
    nutritionReturnRef.current = null;
    setScanMode("products");
    setPreviewUrl(null);
    setScanImageUrl("/samples/latvia-checkout.jpg");
    setMediaDimensions(null);
    setCameraState("idle");
    setDetections([]);
    setTray([]);
    setSelectedId(null);
    manualSelectionRef.current = false;
    setResultLocked(false);
    setResultsExpanded(false);
    setDemoOpen(false);
    track("scan_started", "sample-conveyor");
    void recognize({ source: "sample-conveyor" });
  }, [recognize, stopActiveCapture, track]);

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (file.size > 12_000_000) {
      setRecognitionState("error");
      setStatusMessage("Choose an image smaller than 12 MB.");
      return;
    }
    sessionIdRef.current = makeSessionId();
    stopActiveCapture();
    setSource("upload");
    nutritionReturnRef.current = null;
    setScanMode("products");
    setMediaDimensions(null);
    setCameraState("idle");
    setDetections([]);
    setTray([]);
    setSelectedId(null);
    manualSelectionRef.current = false;
    setResultLocked(false);
    setResultsExpanded(false);
    setDemoOpen(false);
    setRecognitionState("scanning");
    setStatusMessage("Preparing image privately on this device…");
    try {
      const frames = await imageFileToScanFrames(file);
      setPreviewUrl(frames[0]?.imageDataUrl || null);
      setScanImageUrl(frames[0]?.imageDataUrl || null);
      track("scan_started", "upload");
      void recognizeUploadFrames(frames);
    } catch {
      setRecognitionState("error");
      setStatusMessage("This image could not be prepared. Try a JPEG or PNG.");
    }
  }

  const thumbnailSourceUrl =
    source === "sample-shelf"
      ? "/samples/latvia-shelf.jpg"
      : source === "sample-conveyor"
        ? "/samples/latvia-checkout.jpg"
        : source === "upload"
          ? previewUrl
          : scanImageUrl;

  useEffect(() => {
    if (!thumbnailSourceUrl || !detections.length) return;
    let cancelled = false;
    void cropDetectionThumbnails(thumbnailSourceUrl, detections)
      .then((thumbnails) => {
        if (!cancelled) {
          setThumbnailResult((current) => ({
            sourceUrl: thumbnailSourceUrl,
            thumbnails,
            revision: current.revision + 1
          }));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [detections, thumbnailSourceUrl]);

  useEffect(() => {
    const online = () => {
      setNetworkOnline(true);
      setStatusMessage("Back online. Ready to scan.");
    };
    const offline = () => {
      setNetworkOnline(false);
      setStatusMessage("You’re offline. Camera preview stays private, but recognition is paused.");
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void startCamera(), 0);
    return () => {
      window.clearTimeout(timer);
      stopActiveCapture();
    };
  }, [startCamera, stopActiveCapture]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => setStageDimensions({ width: stage.clientWidth, height: stage.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const detectionById = useMemo(
    () => Object.fromEntries(detections.map((detection) => [detection.productId, detection])),
    [detections]
  );
  const detectionThumbnails = thumbnailResult.sourceUrl === thumbnailSourceUrl ? thumbnailResult.thumbnails : {};
  const productById = useMemo(
    () => Object.fromEntries(Object.entries(products).map(([id, payload]) => [id, payload.product])),
    [products]
  );
  const pendingProductIds = useMemo(
    () => new Set([...loadingProductIds, ...enrichingProductIds]),
    [enrichingProductIds, loadingProductIds]
  );
  const ratedTrayIds = useMemo(
    () => ratedScanProductIds(tray, productById),
    [productById, tray]
  );
  const visibleTrayIds = useMemo(
    () => displayableScanProductIds(tray, productById, pendingProductIds),
    [pendingProductIds, productById, tray]
  );
  const visibleTrayIdSet = useMemo(() => new Set(visibleTrayIds), [visibleTrayIds]);
  const ratedTrayIdSet = useMemo(() => new Set(ratedTrayIds), [ratedTrayIds]);
  const loadedTray = ratedTrayIds.map((id) => products[id]?.product).filter(Boolean) as ScoredProduct[];
  const ratedDetections = useMemo(
    () => detections.filter((detection) => ratedTrayIdSet.has(detection.productId)),
    [detections, ratedTrayIdSet]
  );
  const fairComparison = useMemo(() => compareFairCohorts(loadedTray), [loadedTray]);
  const bestId = globalBestProductId(fairComparison);
  const ratedCount = ratedDetections.length;
  const compactSheetTitle = `${visibleTrayIds.length} ${visibleTrayIds.length === 1 ? "product" : "products"}`;
  const rankedTrayIds = useMemo(
    () => rankScanProductIds(visibleTrayIds, productById),
    [productById, visibleTrayIds]
  );
  const rankedRatedIds = useMemo(
    () => rankedTrayIds.filter((id) => hasSugarNoRating(productById[id])),
    [productById, rankedTrayIds]
  );
  const firstRankedId = rankedRatedIds[0] || rankedTrayIds[0];
  const effectiveSelectedId = selectedId && visibleTrayIdSet.has(selectedId)
    ? selectedId
    : bestId || firstRankedId || null;
  const selectedPayload = effectiveSelectedId ? products[effectiveSelectedId] : undefined;
  const selectedDetection = effectiveSelectedId ? detectionById[effectiveSelectedId] : undefined;
  const resultsAreExpanded = resultsExpanded && visibleTrayIds.length > 0;
  const sheetPreviewIds = rankedTrayIds.slice(0, 4);
  const scanHasNoRatedResults =
    recognitionState === "matched" && tray.length > 0 && visibleTrayIds.length === 0 && pendingProductIds.size === 0;
  const displayedStatusMessage =
    recognitionState === "matched" && scanMode === "nutrition-label" && ratedCount > 0
      ? "Sugar.no fit ready from the nutrition label"
      : recognitionState === "matched" && visibleTrayIds.length > 0 && pendingProductIds.size === 0
        ? `${visibleTrayIds.length} ${visibleTrayIds.length === 1 ? "product" : "products"} · ${ratedCount} with Sugar.no fit`
        : scanHasNoRatedResults
          ? "No products with verified Sugar.no fit found"
          : statusMessage;
  const resolvedResultStatusIsRedundant =
    networkOnline &&
    visibleTrayIds.length > 0 &&
    pendingProductIds.size === 0 &&
    (recognitionState === "matched" || recognitionState === "retained");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!manualSelectionRef.current && (bestId || firstRankedId)) setSelectedId(bestId || firstRankedId);
  }, [bestId, firstRankedId]);

  const closeResults = useCallback(() => {
    setResultsExpanded(false);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  const openResults = useCallback(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setResultsExpanded(true);
  }, []);

  const closeDemo = useCallback(() => {
    setDemoOpen(false);
    window.requestAnimationFrame(() => demoTriggerRef.current?.focus());
  }, []);

  const openDemo = useCallback(() => {
    demoTriggerRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    setDemoOpen(true);
  }, []);

  useEffect(() => {
    if (!resultsAreExpanded) return;
    const focusFrame = window.requestAnimationFrame(() => resultsSheetRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeResults();
      else if (resultsSheetRef.current) trapFocus(event, resultsSheetRef.current);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKey);
    };
  }, [closeResults, resultsAreExpanded]);

  useEffect(() => {
    if (!demoOpen) return;
    const focusFrame = window.requestAnimationFrame(() => demoDialogRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDemo();
      else if (demoDialogRef.current) trapFocus(event, demoDialogRef.current);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKey);
    };
  }, [closeDemo, demoOpen]);

  return (
    <main className={styles.app}>
      <header className={`${styles.header} ${styles.scannerHeader}`}>
        <Image
          className={styles.wordmark}
          src="/brand/sugar-no-logo-white.svg"
          alt="Sugar.no"
          width={137}
          height={26.07}
          priority
          unoptimized
        />
      </header>

      <section className={styles.experience} aria-label={`${sourceLabel(source)} scanner`}>
          <div
            ref={stageRef}
            className={`${styles.stage} ${visibleTrayIds.length ? styles.stageWithResults : ""}`}
            inert={resultsAreExpanded || demoOpen}
            aria-hidden={resultsAreExpanded || demoOpen || undefined}
          >
            {cameraState === "live" || cameraState === "requesting" ? (
              <video
                ref={videoRef}
                className={styles.video}
                playsInline
                muted
                autoPlay
                aria-label="Live camera preview"
                onLoadedMetadata={(event) =>
                  setMediaDimensions({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight })
                }
              />
            ) : null}

            {source === "sample-shelf" ? <ShelfScene onLoad={setMediaDimensions} /> : null}

            {source === "sample-conveyor" ? <CheckoutScene onLoad={setMediaDimensions} /> : null}

            {source === "upload" && previewUrl ? (
              <Image
                className={styles.uploadPreview}
                src={previewUrl}
                alt="Uploaded product scene"
                fill
                sizes="100vw"
                unoptimized
                onLoad={(event) =>
                  setMediaDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
                }
              />
            ) : null}

            {cameraState === "denied" || cameraState === "error" ? (
              <div className={styles.cameraError} role="alert">
                <CircleAlert aria-hidden="true" size={30} />
                <strong>{cameraState === "denied" ? "Camera permission is off" : "Camera unavailable"}</strong>
                <span>{statusMessage}</span>
                <button type="button" onClick={startCamera}>
                  <Camera aria-hidden="true" size={17} />
                  {cameraState === "denied" ? "Enable camera" : "Try again"}
                </button>
              </div>
            ) : null}

            {ratedDetections.map((detection) => {
              const product = products[detection.productId]?.product;
              const presentation = overlayMatchPresentation(product);
              const displayName = product?.name || detection.identity?.name || detection.observedText || "product";
              const mappedBox = mediaDimensions && stageDimensions
                ? source === "camera"
                  ? mapBoxToObjectContain(detection.box, mediaDimensions, stageDimensions)
                  : mapBoxToObjectCover(detection.box, mediaDimensions, stageDimensions)
                : detection.box;
              const isBest = bestId === detection.productId;
              return (
                <button
                  className={`${styles.detectionBox} ${toneClass(presentation.tone)} ${completenessClass(presentation.completeness)} ${effectiveSelectedId === detection.productId ? styles.selectedBox : ""} ${isBest ? styles.bestBox : ""}`}
                  data-testid="rated-detection-marker"
                  style={{
                    left: `${mappedBox.x * 100}%`,
                    top: `${mappedBox.y * 100}%`,
                    width: `${mappedBox.width * 100}%`,
                    height: `${mappedBox.height * 100}%`
                  }}
                  type="button"
                  key={`${detection.productId}-${detection.box.x}`}
                  onClick={() => {
                    manualSelectionRef.current = true;
                    setSelectedId(detection.productId);
                    track("result_opened", source, detection.productId);
                  }}
                  aria-label={`Open ${displayName}: ${presentation.label}${isBest ? ", best in this scan" : ""}`}
                >
                  <span>
                    <OverlayToneIcon tone={presentation.tone} />
                    <strong>{isBest ? `Best · ${presentation.label}` : presentation.label}</strong>
                  </span>
                </button>
              );
            })}

            <div
              className={`${styles.stageTopbar} ${source === "upload" && scanMode === "products" ? styles.stageTopbarEnd : ""}`}
            >
              {source === "upload" && scanMode === "products" ? null : (
                <span>{scanMode === "nutrition-label" ? "Nutrition label" : sourceLabel(source)}</span>
              )}
              <button
                ref={source === "camera" && scanMode === "products" ? demoTriggerRef : undefined}
                className={styles.demoTrigger}
                type="button"
                onClick={source === "camera" && scanMode === "products" ? openDemo : startCamera}
                aria-label={
                  source === "camera" && scanMode === "products"
                    ? "Show demo"
                    : scanMode === "nutrition-label"
                      ? "Back to product scan"
                      : "Back to live camera"
                }
              >
                {source === "camera" && scanMode === "products" ? <Layers3 aria-hidden="true" size={17} /> : <Camera aria-hidden="true" size={17} />}
                {source === "camera" && scanMode === "products"
                  ? "Show demo"
                  : scanMode === "nutrition-label"
                    ? "Scan products"
                    : "Back to live"}
              </button>
            </div>

            {resolvedResultStatusIsRedundant ? (
              <span className={styles.screenReaderStatus} role="status" aria-live="polite">
                {displayedStatusMessage}
              </span>
            ) : (
              <div className={styles.stageStatus} data-testid="stage-status-pill" role="status" aria-live="polite">
                {recognitionState === "scanning" ? (
                  <LoaderCircle className={styles.spin} aria-hidden="true" size={17} />
                ) : recognitionState === "matched" || recognitionState === "retained" ? (
                  <Check aria-hidden="true" size={17} />
                ) : recognitionState === "not_sure" || recognitionState === "error" || recognitionState === "unavailable" || recognitionState === "rate_limited" ? (
                  <Info aria-hidden="true" size={17} />
                ) : (
                  <ScanLine aria-hidden="true" size={17} />
                )}
                <span>{networkOnline ? displayedStatusMessage : "Offline — recognition paused"}</span>
                {source === "camera" && (recognitionState === "unavailable" || recognitionState === "rate_limited" || scanHasNoRatedResults) ? (
                  <button className={styles.recognitionRetry} type="button" onClick={scanAgain}>
                    <RefreshCw aria-hidden="true" size={15} /> Try again
                  </button>
                ) : null}
              </div>
            )}
            <p className={styles.privacyNoteStage}>Frames are analyzed, never stored.</p>
          </div>

          {visibleTrayIds.length ? (
            <aside
              ref={resultsSheetRef}
              className={`${styles.resultsSheet} ${resultsAreExpanded ? styles.resultsExpanded : styles.resultsCollapsed}`}
              role={resultsAreExpanded ? "dialog" : undefined}
              aria-modal={resultsAreExpanded ? "true" : undefined}
              aria-label="Products from this scan"
              tabIndex={resultsAreExpanded ? -1 : undefined}
            >
              <div className={styles.sheetChrome}>
                {resultsAreExpanded ? (
                  <button
                    className={styles.sheetIconButton}
                    type="button"
                    onClick={closeResults}
                    aria-label="Collapse product results"
                  >
                    <ChevronDown aria-hidden="true" size={20} />
                  </button>
                ) : (
                  <>
                    <div className={styles.sheetTitleStatic}>
                      <strong>{compactSheetTitle}</strong>
                      <span>
                        {ratedCount > 0
                          ? pendingProductIds.size
                            ? `${ratedCount} rated · Checking the rest…`
                            : `${ratedCount} rated · Best fit first`
                          : pendingProductIds.size
                            ? "Checking exact nutrition online…"
                            : "Products identified · Nutrition checked online"}
                      </span>
                    </div>
                    <div className={styles.sheetActions}>
                      <button type="button" onClick={openResults} aria-controls="scan-results-content">
                        <List aria-hidden="true" size={17} /> <span>View all</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {!resultsAreExpanded ? (
                <div className={styles.sheetPreview} aria-label="Product result preview">
                  {sheetPreviewIds.map((id) => {
                    const item = products[id]?.product;
                    const detection = detectionById[id];
                    const isRated = hasSugarNoRating(item);
                    const rank = isRated ? rankedRatedIds.indexOf(id) + 1 : null;
                    const previewPresentation = isRated ? overlayMatchPresentation(item) : null;
                    const sugar = item?.nutrientsPer100g.totalSugarG;
                    const previewBasisLabel = item?.nutritionBasis === "100ml" ? "100 milliliters" : "100 grams";
                    const retailerOffer = detection?.retailerOffer?.exactSku
                      ? detection.retailerOffer
                      : null;
                    const cheaperOffer =
                      detection?.shelfPrice &&
                      retailerOffer &&
                      retailerOffer.price < detection.shelfPrice.amount
                        ? retailerOffer
                        : null;
                    return (
                      <article
                        className={`${styles.sheetPreviewCard} ${cheaperOffer ? styles.sheetPreviewCardDeal : ""}`}
                        key={id}
                      >
                        <button
                          className={styles.sheetPreviewOpen}
                          type="button"
                          aria-label={
                            isRated && previewPresentation
                              ? `Rank ${rank}, ${item.brand} ${item.shortName}, ${previewPresentation.label}, Sugar ${sugar} grams per ${previewBasisLabel}`
                              : `${item?.brand || detection?.identity?.brand || "Product"} ${item?.shortName || detection?.identity?.name || "identified product"}, nutrition not verified online`
                          }
                          onClick={() => {
                            manualSelectionRef.current = true;
                            setSelectedId(id);
                            openResults();
                            track("result_opened", source, id);
                          }}
                        >
                          <span
                            className={`${styles.sheetPreviewRank} ${isRated ? "" : styles.rankPending}`}
                            aria-hidden="true"
                          >
                            {rank ? `#${rank}` : "—"}
                          </span>
                          <div className={styles.sheetPreviewThumb} aria-hidden="true">
                            <ProductThumbnail
                              key={`${id}:${item?.imageUrl || detection?.retailerOffer?.imageUrl || "crop"}:${thumbnailResult.revision}`}
                              primaryUrl={item?.imageUrl || detection?.retailerOffer?.imageUrl}
                              fallbackUrl={detectionThumbnails[id]}
                              sizes="42px"
                            />
                          </div>
                          <div className={styles.sheetPreviewCopy}>
                            <span>{item?.brand || detection?.identity?.brand || "Product"}</span>
                            {item && hasSugarNoRating(item) ? (
                              <>
                                <MatchPill product={item} />
                                <small className={styles.sheetPreviewSugar}>Sugar {sugar}g</small>
                              </>
                            ) : (
                              <small>{pendingProductIds.has(id) ? "Checking online…" : "Nutrition not verified online"}</small>
                            )}
                            <CompactProductPrice detection={detection} />
                          </div>
                        </button>
                        {cheaperOffer ? (
                          <a
                            className={styles.sheetPreviewBuy}
                            href={cheaperOffer.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Buy ${item?.shortName || detection?.identity?.name || "product"} cheaper at Barbora for €${cheaperOffer.price.toFixed(2)}`}
                            onClick={() =>
                              track("retailer_link_clicked", source, id, { placement: "compact_price_cta" })
                            }
                          >
                            <span>Buy cheaper</span>
                            <strong>€{cheaperOffer.price.toFixed(2)}</strong>
                            <ArrowUpRight aria-hidden="true" size={15} />
                          </a>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.sheetContent} id="scan-results-content">
                  {visibleTrayIds.length === 1 ? (
                    <div className={styles.scanSummary}>
                      <div>
                        <strong>
                          {ratedCount > 0
                            ? "Ready to compare"
                            : pendingProductIds.size
                              ? "Checking product online…"
                              : "Product identified"}
                        </strong>
                        <span>{resultLocked ? "Result held while you read" : "Product result"}</span>
                      </div>
                      <button
                        className={styles.scanAgainButton}
                        type="button"
                        onClick={source === "camera" ? scanAgain : startCamera}
                      >
                          <RefreshCw aria-hidden="true" size={16} /> Scan again
                      </button>
                    </div>
                  ) : null}

                  {visibleTrayIds.length > 1 ? (
                    <section className={styles.rankingSection} aria-labelledby="scan-ranking-title">
                      <div className={styles.rankingHeading}>
                        <h2 id="scan-ranking-title">
                          {ratedCount > 0 ? "Best fit first" : pendingProductIds.size ? "Checking nutrition online" : "Products identified"}
                        </h2>
                      </div>
                      <ol className={styles.rankedList} aria-label="Products ranked by Sugar.no fit">
                        {rankedTrayIds.map((id) => {
                          const item = products[id]?.product;
                          const detection = detectionById[id];
                          const itemBrand = item?.brand || detection?.identity?.brand || "Product";
                          const itemName = item?.shortName || detection?.identity?.name || "Identified product";
                          const isRated = hasSugarNoRating(item);
                          const rank = isRated ? rankedRatedIds.indexOf(id) + 1 : null;
                          const presentation = isRated ? overlayMatchPresentation(item) : null;
                          const protein = item?.nutrientsPer100g.proteinG;
                          const sugar = item?.nutrientsPer100g.totalSugarG;
                          const retailerOffer = detection?.retailerOffer?.exactSku
                            ? detection.retailerOffer
                            : null;
                          const cheaperOffer =
                            detection?.shelfPrice &&
                            retailerOffer &&
                            retailerOffer.price < detection.shelfPrice.amount
                              ? retailerOffer
                              : null;
                          return (
                            <li
                              className={`${styles.rankedProduct} ${effectiveSelectedId === id ? styles.activeRankedProduct : ""}`}
                              key={id}
                            >
                              <button
                                type="button"
                                aria-label={
                                  isRated && presentation
                                    ? `Rank ${rank}, ${itemBrand} ${itemName}, ${presentation.label}`
                                    : `${itemBrand} ${itemName}, nutrition not verified online`
                                }
                                className={styles.rankedProductOpen}
                                onClick={() => {
                                  manualSelectionRef.current = true;
                                  setSelectedId(id);
                                  track("result_opened", source, id);
                                }}
                              >
                                <span className={`${styles.rankPosition} ${isRated ? "" : styles.rankPending}`} aria-hidden="true">
                                  {rank ? `#${rank}` : "—"}
                                </span>
                                <span className={styles.rankedProductThumb} aria-hidden="true">
                                  <ProductThumbnail
                                    key={`${id}:${item?.imageUrl || detection?.retailerOffer?.imageUrl || "crop"}:${thumbnailResult.revision}`}
                                    primaryUrl={item?.imageUrl || detection?.retailerOffer?.imageUrl}
                                    fallbackUrl={detectionThumbnails[id]}
                                    sizes="48px"
                                  />
                                </span>
                                <div className={styles.rankedProductCopy}>
                                  <small>{itemBrand}</small>
                                  <strong>{itemName}</strong>
                                  <div className={styles.rankedProductMeta}>
                                    {isRated ? (
                                      <>
                                        <MatchPill product={item} />
                                        <small>Protein {protein}g · Sugar {sugar}g</small>
                                      </>
                                    ) : (
                                      <small>{pendingProductIds.has(id) ? "Checking online…" : "Nutrition not verified online"}</small>
                                    )}
                                  </div>
                                  {!cheaperOffer ? <CompactProductPrice detection={detection} /> : null}
                                </div>
                              </button>
                              {cheaperOffer && detection?.shelfPrice ? (
                                <a
                                  className={styles.rankedProductDeal}
                                  href={cheaperOffer.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Buy ${itemName} cheaper at Barbora for €${cheaperOffer.price.toFixed(2)} instead of shelf price €${detection.shelfPrice.amount.toFixed(2)}`}
                                  onClick={() =>
                                    track("retailer_link_clicked", source, id, { placement: "ranked_price_cta" })
                                  }
                                >
                                  <s>€{detection.shelfPrice.amount.toFixed(2)}</s>
                                  <strong>€{cheaperOffer.price.toFixed(2)}</strong>
                                  <span>Buy cheaper at Barbora</span>
                                  <ArrowUpRight aria-hidden="true" size={15} />
                                </a>
                              ) : null}
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  ) : null}

                  {selectedPayload ? (
                    <ProductResult
                      payload={selectedPayload}
                      scanDetections={detectionById}
                      showSummary={visibleTrayIds.length === 1}
                      onAlternative={(id) => {
                        manualSelectionRef.current = true;
                        setSelectedId(id);
                        if (!products[id]) void hydrateProducts([id]);
                        track("alternative_viewed", source, id);
                      }}
                      onRetailer={(id) => track("retailer_link_clicked", source, id)}
                    />
                  ) : selectedDetection?.identity && effectiveSelectedId && pendingProductIds.has(effectiveSelectedId) ? (
                    <LoadingProductResult detection={selectedDetection} />
                  ) : selectedDetection?.identity ? (
                    <RecognizedProductResult detection={selectedDetection} />
                  ) : null}
                </div>
              )}
            </aside>
          ) : null}
      </section>

      {demoOpen ? (
        <div className={styles.demoBackdrop} role="presentation">
          <div
            ref={demoDialogRef}
            className={styles.demoDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-title"
            tabIndex={-1}
          >
            <div className={styles.demoHeading}>
              <div>
                <p>Guided preview</p>
                <h2 id="demo-title">See how a shelf scan works</h2>
              </div>
              <button type="button" onClick={closeDemo} aria-label="Close demo chooser">
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <div className={styles.demoChoices}>
              <button type="button" onClick={startShelf}>
                <Layers3 aria-hidden="true" size={22} />
                <span><strong>Shelf demo</strong><small>Compare several products at once</small></span>
              </button>
              <button type="button" onClick={startCheckout}>
                <ShoppingBasket aria-hidden="true" size={22} />
                <span><strong>Checkout demo</strong><small>Read products on a checkout belt</small></span>
              </button>
              <label className={styles.demoUpload}>
                <FileImage aria-hidden="true" size={22} />
                <span><strong>Use saved photo</strong><small>Choose a shelf or checkout image</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} />
              </label>
            </div>
            <button className={styles.backToLive} type="button" onClick={closeDemo}>
              <Camera aria-hidden="true" size={18} /> Back to live camera
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ShelfScene({ onLoad }: { onLoad: (dimensions: MediaDimensions) => void }) {
  return (
    <div className={styles.shelfScene} aria-label="Sample shelf photo with four supported protein snacks">
      <Image
        className={styles.samplePhoto}
        src="/samples/latvia-shelf.jpg"
        alt="Four protein bars on a supermarket shelf"
        fill
        sizes="100vw"
        priority
        unoptimized
        onLoad={(event) => onLoad({
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight
        })}
      />
    </div>
  );
}

function CheckoutScene({ onLoad }: { onLoad: (dimensions: MediaDimensions) => void }) {
  return (
    <div className={styles.checkoutScene} aria-label="Real supermarket checkout belt sample with three recognized packaged products">
      <Image
        className={styles.samplePhoto}
        src="/samples/latvia-checkout.jpg"
        alt="Groceries on a real supermarket checkout conveyor belt"
        fill
        sizes="100vw"
        priority
        unoptimized
        onLoad={(event) => onLoad({
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight
        })}
      />
    </div>
  );
}

function ProductResult({
  payload,
  scanDetections,
  showSummary,
  onAlternative,
  onRetailer
}: {
  payload: ProductPayload;
  scanDetections: Record<string, ProductDetection>;
  showSummary: boolean;
  onAlternative: (id: string) => void;
  onRetailer: (id: string) => void;
}) {
  const { product, alternatives } = payload;
  const alternativeSlugs = useMemo(
    () => alternatives.map((alternative) => barboraProductSlug(alternative.retailerUrl)).filter(Boolean) as string[],
    [alternatives]
  );
  const offerRequestKey = alternativeSlugs.join("|");
  const [offerResult, setOfferResult] = useState<{
    key: string;
    offers: Record<string, RetailerOffer | null>;
  }>({ key: "", offers: {} });

  useEffect(() => {
    if (!offerRequestKey) return;
    const controller = new AbortController();
    void fetch("/api/offers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slugs: alternativeSlugs }),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Alternative prices unavailable");
        return response.json() as Promise<AlternativeOfferResponse>;
      })
      .then((response) => setOfferResult({ key: offerRequestKey, offers: response.offers }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setOfferResult({ key: offerRequestKey, offers: {} });
        }
      });
    return () => controller.abort();
  }, [alternativeSlugs, offerRequestKey]);

  const alternativeOffers = offerResult.key === offerRequestKey ? offerResult.offers : {};
  const pricesLoading = Boolean(offerRequestKey && offerResult.key !== offerRequestKey);
  return (
    <article className={styles.productResult}>
      {showSummary ? (
        <div className={styles.productHeading}>
          <div>
            <p className={styles.productBrand}>{product.brand}</p>
            <h2>{product.shortName}</h2>
          </div>
        </div>
      ) : null}

      {showSummary && product.ratingSignalCount > 0 ? <SugarNoBadge product={product} /> : null}

      {showSummary && product.ratingStatus === "identity_only" ? (
        <div className={styles.pendingDataAction}>
          <Info aria-hidden="true" size={18} />
          <span>
            <strong>Nutrition not verified online</strong>
            Sugar.no checked its catalog, Barbora, Open Food Facts and cited web results, but will not invent a fit without an exact per-100 source.
          </span>
        </div>
      ) : null}

      {showSummary && product.noAddedSugarClaim ? (
        <div className={styles.claimBadge}>
          <Check aria-hidden="true" size={15} /> No added sugar claim on source label
        </div>
      ) : null}

      {alternatives.length ? (
        <section className={styles.alternatives} aria-labelledby={`alternatives-${product.id}`}>
          <div className={styles.sectionHeading}>
            <div>
              <p>Similar options</p>
              <h3 id={`alternatives-${product.id}`}>Compare without starting over</h3>
            </div>
          </div>
          <div className={styles.alternativeList}>
            {alternatives.map((alternative) => {
              const slug = barboraProductSlug(alternative.retailerUrl);
              const offer = slug ? alternativeOffers[slug] : null;
              const shelfPrice = scanDetections[alternative.id]?.shelfPrice;
              const cheaperOnline = isExactOnlineSaving(offer, shelfPrice);
              return (
                <article className={styles.alternativeCard} key={alternative.id}>
                  <button
                    className={styles.alternativeOpen}
                    type="button"
                    onClick={() => onAlternative(alternative.id)}
                    aria-label={`Compare ${alternative.name}`}
                  >
                    <div className={styles.alternativeThumb}>
                      {alternative.imageUrl ? (
                        <Image src={alternative.imageUrl} alt="" fill sizes="58px" />
                      ) : null}
                    </div>
                    <span>
                      <small>{alternative.brand}</small>
                      <strong>{alternative.shortName}</strong>
                      <MatchPill product={alternative} />
                    </span>
                  </button>
                  {slug ? (
                    <a
                      className={styles.alternativeBuy}
                      href={offer?.url || alternative.retailerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onRetailer(alternative.id)}
                      aria-label={`${cheaperOnline ? "Buy cheaper online" : "Buy online"} ${alternative.name}${offer ? ` for €${offer.price.toFixed(2)}` : ""}`}
                    >
                      <span>
                        <strong>{cheaperOnline ? "Cheaper online" : "Buy online"}</strong>
                        {cheaperOnline && shelfPrice ? <s>€{shelfPrice.amount.toFixed(2)} shelf</s> : null}
                      </span>
                      <span className={styles.alternativeBuyPrice}>
                        {offer ? `€${offer.price.toFixed(2)}` : pricesLoading ? "Checking…" : ""}
                        <ArrowUpRight aria-hidden="true" size={16} />
                      </span>
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function RecognizedProductResult({ detection }: { detection: ProductDetection }) {
  const identity = detection.identity!;
  const visiblePackSize =
    identity.packSize && !identity.name.toLowerCase().includes(identity.packSize.toLowerCase())
      ? identity.packSize
      : null;
  return (
    <article className={styles.productResult}>
      <div className={styles.productHeading}>
        <div>
          <p className={styles.productBrand}>{identity.brand || "Recognized package"}</p>
          <h2>{[identity.name, identity.variant, visiblePackSize].filter(Boolean).join(" · ")}</h2>
        </div>
        <span className={styles.recognizedBadge}>
          <ScanLine aria-hidden="true" size={15} /> Identified
        </span>
      </div>

      <div className={styles.pendingDataAction}>
        <Info aria-hidden="true" size={18} />
        <span>
          <strong>Nutrition not verified online</strong>
          Sugar.no will not invent protein or sugar values when an exact source cannot be confirmed.
        </span>
      </div>
    </article>
  );
}

function LoadingProductResult({ detection }: { detection: ProductDetection }) {
  const identity = detection.identity!;
  return (
    <article className={styles.productResult} aria-live="polite">
      <div className={styles.productHeading}>
        <div>
          <p className={styles.productBrand}>{identity.brand || "Recognized package"}</p>
          <h2>{identity.name}</h2>
        </div>
      </div>
      <div className={styles.pendingData}>
        <LoaderCircle className={styles.spin} aria-hidden="true" size={18} />
        <span>
          <strong>Checking nutrition online…</strong>
          Checking the Sugar.no catalog, Barbora, Open Food Facts and cited web results.
        </span>
      </div>
    </article>
  );
}

function CompactProductPrice({ detection }: { detection?: ProductDetection }) {
  const shelfPrice = detection?.shelfPrice;
  if (!shelfPrice) return null;
  const offer = detection.retailerOffer?.exactSku ? detection.retailerOffer : null;
  const cheaperAtBarbora = Boolean(offer && offer.price < shelfPrice.amount);
  const shelfPriceLabel = shelfPrice.observedText.startsWith("Demo shelf price") ? "Demo shelf price" : "Shelf price";
  const accessibleLabel = cheaperAtBarbora && offer
    ? `${shelfPriceLabel} €${shelfPrice.amount.toFixed(2)}, Barbora €${offer.price.toFixed(2)}, cheaper at Barbora`
    : `${shelfPriceLabel} €${shelfPrice.amount.toFixed(2)}`;

  return (
    <div className={styles.compactProductPrice} role="group" aria-label={accessibleLabel}>
      {cheaperAtBarbora ? (
        <s className={styles.compactCrossedPrice}>€{shelfPrice.amount.toFixed(2)}</s>
      ) : (
        <span>€{shelfPrice.amount.toFixed(2)}</span>
      )}
      {cheaperAtBarbora && offer ? (
        <>
          <strong>€{offer.price.toFixed(2)}</strong>
          <small>Barbora</small>
        </>
      ) : (
        <small>shelf</small>
      )}
    </div>
  );
}

function SugarNoBadge({ product }: { product: ScoredProduct }) {
  const presentation = overlayMatchPresentation(product);
  const criteria = matchCriteria(product);
  const nutritionSourceLabel = product.ratingBasis.startsWith("catalog_")
    ? "Sugar.no badge"
    : product.ratingBasis.startsWith("barbora_")
      ? "Exact Barbora nutrition"
      : product.ratingBasis.startsWith("open_food_facts_")
        ? "Open Food Facts nutrition"
        : product.ratingBasis.startsWith("web_search_")
          ? "Verified web nutrition"
        : product.ratingBasis.startsWith("manufacturer_")
          ? "Manufacturer nutrition"
          : product.ratingBasis.startsWith("food_composition_")
            ? "Food composition reference"
            : "Nutrition label in this scan";
  const values = {
    protein: product.nutrientsPer100g.proteinG,
    sugar: product.nutrientsPer100g.totalSugarG
  };
  return (
    <section className={styles.sugarBadge} aria-label="Sugar.no badge">
      <div className={styles.sugarBadgeHeading}>
        <div>
          <small>{nutritionSourceLabel}</small>
          <strong>
            {product.ratingStatus === "complete" ? "Sugar.no fit" : "Sugar.no limited view · 1/2"}
          </strong>
        </div>
        <span className={toneClass(presentation.tone)}>{presentation.label}</span>
      </div>
      <div className={styles.criteria}>
        {criteria.map((criterion) => (
          <div className={`${styles.criterion} ${toneClass(criterion.tone)}`} key={criterion.key}>
            <i aria-hidden="true" />
            <span>{criterion.label}</span>
            <strong>{values[criterion.key] === null ? "—" : `${values[criterion.key]}g`}</strong>
            <small>{criterion.status}</small>
          </div>
        ))}
      </div>
      <p className={styles.perHundred}>
        {product.ratingBasis === "catalog_percentile" && product.ratingStatus === "complete"
          ? "Values per 100 g · Compared with protein snacks in this demo"
          : `Values per ${product.nutritionBasis === "100ml" ? "100 ml" : "100 g"} · ${product.ratingSignalCount} of 2 source-backed signals`}
      </p>
    </section>
  );
}

function MatchPill({ product }: { product: ScoredProduct }) {
  const presentation = overlayMatchPresentation(product);
  return (
    <em className={`${styles.matchPill} ${toneClass(presentation.tone)}`}>
      {presentation.label}
      {product.ratingSignalCount > 0 && product.ratingSignalCount < 2 ? ` · ${product.ratingSignalCount}/2` : ""}
    </em>
  );
}
