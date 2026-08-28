"use client";

import Image from "next/image";
import {
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  CircleAlert,
  FileImage,
  Hand,
  Info,
  Layers3,
  LoaderCircle,
  List,
  RefreshCw,
  ScanLine,
  ShoppingBasket,
  ThumbsDown,
  ThumbsUp,
  X
} from "lucide-react";
import { ChangeEvent, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAMERA_FOCUS_CROP,
  mapBoxToObjectCover,
  mapBoxToObjectContain,
  remapRecognitionFromCrop,
  type MediaDimensions
} from "@/lib/camera-focus";
import {
  globalBestProductId,
  overlayMatchPresentation,
  rankScanProductIds,
  type MatchTone,
  type SignalCompleteness
} from "@/lib/match-presentation";
import { imageFileToScanFrames, type PreparedUploadFrame } from "@/lib/client-image";
import { mergeEnrichedDetections } from "@/lib/detection-merge";
import { dedupeProductDetections } from "@/lib/product-detection-dedupe";
import { displayableScanProductIds, hasSugarNoRating, ratedScanProductIds } from "@/lib/rating-visibility";
import { barboraProductSlug } from "@/lib/online-offer";
import { mapWithConcurrency, mergeProgressiveEnrichment } from "@/lib/product-enrichment";
import { MAX_SCAN_PRODUCTS } from "@/lib/scan-limits";
import { compareFairCohorts } from "@/lib/scoring";
import { mergeUploadScanResults } from "@/lib/upload-scan";
import type {
  ProductDetection,
  RecognitionEnrichmentResponse,
  RecognitionResponse,
  RetailerOffer,
  ScanSource,
  ScoredProduct
} from "@/lib/types";
import { thumbnailCrop, type ImageDimensions } from "@/lib/thumbnail-crop";
import {
  CompactProductPrice,
  LoadingProductResult,
  MatchPill,
  OnlineOfferAction,
  ProductResult,
  RecognizedProductResult,
  type ProductPayload
} from "./scanner-results";
import { CheckoutScene, ShelfScene } from "./scanner-scenes";
import styles from "./scanner-app.module.css";

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
  if (tone === "strong") {
    return <ThumbsUp aria-hidden="true" data-fit-icon="great" size={12} strokeWidth={2.5} />;
  }
  if (tone === "middle") {
    return <Hand aria-hidden="true" data-fit-icon="moderate" size={12} strokeWidth={2.5} />;
  }
  if (tone === "lower") {
    return <ThumbsDown aria-hidden="true" data-fit-icon="low" size={12} strokeWidth={2.5} />;
  }
  return <ScanLine aria-hidden="true" data-fit-icon="pending" size={12} strokeWidth={2.5} />;
}

function completenessClass(completeness: SignalCompleteness) {
  if (completeness === "full") return styles.completenessFull;
  if (completeness === "partial") return styles.completenessPartial;
  if (completeness === "limited") return styles.completenessLimited;
  return styles.completenessIdentified;
}

function cropBackgroundStyle(
  imageUrl: string,
  box: ProductDetection["box"],
  sourceDimensions: ImageDimensions | null | undefined,
  targetAspect: number
): CSSProperties {
  if (!sourceDimensions) {
    return {
      backgroundImage: `url(${JSON.stringify(imageUrl)})`,
      backgroundPosition: `${Math.max(0, Math.min(1, box.x + box.width / 2)) * 100}% ${Math.max(0, Math.min(1, box.y + box.height / 2)) * 100}%`,
      backgroundSize: "cover"
    };
  }
  const crop = thumbnailCrop(box, sourceDimensions, targetAspect);
  return {
    backgroundImage: `url(${JSON.stringify(imageUrl)})`,
    backgroundPosition: `${(crop.x / Math.max(0.001, 1 - crop.width)) * 100}% ${(crop.y / Math.max(0.001, 1 - crop.height)) * 100}%`,
    backgroundSize: `${100 / crop.width}% ${100 / crop.height}%`
  };
}

function ProductThumbnail({
  imageUrl,
  sceneImageUrl,
  sceneDimensions,
  detection,
  sizes,
  targetAspect
}: {
  imageUrl?: string | null;
  sceneImageUrl?: string | null;
  sceneDimensions?: ImageDimensions | null;
  detection?: ProductDetection;
  sizes: string;
  targetAspect: number;
}) {
  if (imageUrl) return <Image src={imageUrl} alt="" fill sizes={sizes} />;
  if (sceneImageUrl && detection) {
    return (
      <span
        className={styles.sceneProductCrop}
        data-testid="scene-product-crop"
        data-thumbnail-mode="context-crop"
        style={cropBackgroundStyle(sceneImageUrl, detection.box, sceneDimensions, targetAspect)}
      />
    );
  }
  return <ScanLine className={styles.productThumbFallbackIcon} aria-hidden="true" size={18} />;
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

  const [source, setSource] = useState<ScanSource>("camera");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [recognitionState, setRecognitionState] = useState<RecognitionState>("idle");
  const [detections, setDetections] = useState<ProductDetection[]>([]);
  const [tray, setTray] = useState<string[]>([]);
  const [products, setProducts] = useState<Record<string, ProductPayload>>({});
  const [loadingProductIds, setLoadingProductIds] = useState<string[]>([]);
  const [enrichingProductIds, setEnrichingProductIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanFrameUrl, setScanFrameUrl] = useState<string | null>(null);
  const [scanOffers, setScanOffers] = useState<Record<string, RetailerOffer | null>>({});
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
                (["barbora", "retailer_catalog", "open_food_facts"].includes(enrichedDetection.identity?.matchKind || "")
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
    (result: RecognitionResponse, eventSource: ScanSource, focusMode = false) => {
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
        if (eventSource === "camera" && shelfCompletionRetryRef.current) {
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
      const inlineEntries: Array<[string, ProductPayload]> = uniqueDetections.flatMap((detection) =>
        detection.inlineProduct
          ? [[detection.productId, { product: detection.inlineProduct, alternatives: [] as ScoredProduct[] }]]
          : []
      );
      if (inlineEntries.length) {
        setProducts((current) => ({ ...current, ...Object.fromEntries(inlineEntries) }));
      }
      const needsShelfCompletionRetry =
        eventSource === "camera" &&
        !focusMode &&
        uniqueDetections.length === 1 &&
        !shelfCompletionRetryRef.current;
      setRecognitionState(needsShelfCompletionRetry ? "scanning" : "matched");
      setDetections(uniqueDetections);
      const ids = uniqueDetections.map((detection) => detection.productId);
      const catalogIds = uniqueDetections
        .map(
          (detection) =>
            detection.catalogProductId ||
            (["barbora", "retailer_catalog", "open_food_facts"].includes(detection.identity?.matchKind || "")
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
      if (eventSource === "camera") {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
        videoRef.current?.pause();
        setResultLocked(true);
      }
      setResultsExpanded(eventSource === "upload" && ids.length > 1);
      setStatusMessage("Products found. Checking Sugar.no signals…");
      setTray(ids);
      manualSelectionRef.current = false;
      setSelectedId(ids[0] || null);
      void hydrateProducts(catalogIds);
      track("scan_completed", eventSource, ids[0], {
        count: ids.length,
        latencyMs: result.latencyMs,
        model: result.model,
        minConfidence: Math.min(...uniqueDetections.map((detection) => detection.confidence)),
        meanConfidence:
          uniqueDetections.reduce((sum, detection) => sum + detection.confidence, 0) /
          uniqueDetections.length
      });
      if (["camera", "upload"].includes(eventSource)) {
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
    }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const controller = new AbortController();
      recognitionAbortRef.current = controller;
      setRecognitionState("scanning");
      setStatusMessage("Reading visible products…");
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
          Boolean(payload.focusMode)
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
    const focusMode = focusRetryRef.current;
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
    if (!focusMode) setScanFrameUrl(imageDataUrl);
    void recognize({
      source: "camera",
      imageDataUrl,
      focusMode
    });
  }, [recognize]);

  const requestCamera = useCallback(async () => {
    sessionIdRef.current = makeSessionId();
    stopActiveCapture();
    const requestId = cameraRequestRef.current;
    setSource("camera");
    setPreviewUrl(null);
    setScanFrameUrl(null);
    setScanOffers({});
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
          facingMode: { ideal: "environment" }
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
      if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
        setMediaDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight });
      }
      setCameraState("live");
      setRecognitionState("idle");
      setStatusMessage("Point at several products and hold steady");
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

  const startCamera = useCallback(() => requestCamera(), [requestCamera]);

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
    focusRetryRef.current = false;
    shelfCompletionRetryRef.current = false;
    provisionalResponseRef.current = null;
    lastCaptureRef.current = 0;
    setDetections([]);
    setTray([]);
    setSelectedId(null);
    setScanFrameUrl(null);
    setScanOffers({});
    manualSelectionRef.current = false;
    setRecognitionState("idle");
    setResultLocked(false);
    setResultsExpanded(false);
    setStatusMessage("Point at several products and hold steady");
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
    setPreviewUrl(null);
    setScanFrameUrl(null);
    setScanOffers({});
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
    setPreviewUrl(null);
    setScanFrameUrl(null);
    setScanOffers({});
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
    setScanFrameUrl(null);
    setScanOffers({});
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
      track("scan_started", "upload");
      void recognizeUploadFrames(frames);
    } catch {
      setRecognitionState("error");
      setStatusMessage("This image could not be prepared. Try a JPEG or PNG.");
    }
  }

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
    () => displayableScanProductIds(tray, productById, pendingProductIds, detectionById),
    [detectionById, pendingProductIds, productById, tray]
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
  const offerSlugsByProductId = useMemo(
    () =>
      Object.fromEntries(
        rankedTrayIds.flatMap((id) => {
          const slug = productById[id] ? barboraProductSlug(productById[id].retailerUrl) : null;
          return slug ? [[id, slug] as const] : [];
        })
      ),
    [productById, rankedTrayIds]
  );
  const scanOfferKey = Object.values(offerSlugsByProductId).sort().join("|");

  useEffect(() => {
    if (!scanOfferKey) return;
    const controller = new AbortController();
    void fetch("/api/offers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slugs: [...new Set(Object.values(offerSlugsByProductId))] }),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Scan offers unavailable");
        return response.json() as Promise<{ offers: Record<string, RetailerOffer | null> }>;
      })
      .then((response) => setScanOffers(response.offers))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setScanOffers({});
      });
    return () => controller.abort();
  }, [offerSlugsByProductId, scanOfferKey]);

  const scanOfferForId = useCallback(
    (id: string): RetailerOffer | null => {
      const detected = detectionById[id]?.retailerOffer;
      if (detected && !detected.exactSku) return null;
      if (detected?.exactSku) return detected;
      const slug = offerSlugsByProductId[id];
      return slug ? scanOffers[slug] || null : null;
    },
    [detectionById, offerSlugsByProductId, scanOffers]
  );
  const sceneImageUrl =
    source === "sample-shelf"
      ? "/samples/latvia-shelf.jpg"
      : source === "sample-conveyor"
        ? "/samples/latvia-checkout.jpg"
        : source === "upload"
          ? previewUrl
          : scanFrameUrl;
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
    recognitionState === "matched" && visibleTrayIds.length > 0 && pendingProductIds.size === 0
      ? `${visibleTrayIds.length} ${visibleTrayIds.length === 1 ? "product" : "products"} · ${ratedCount} with Sugar.no fit`
      : scanHasNoRatedResults
        ? "No products with verified Sugar.no fit found"
        : statusMessage;

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
            className={`${styles.stage} ${visibleTrayIds.length ? styles.stageWithResults : ""}`}
            inert={resultsAreExpanded || demoOpen}
            aria-hidden={resultsAreExpanded || demoOpen || undefined}
          >
            <div
              className={`${styles.stageTopbar} ${source === "camera" || source === "upload" ? styles.stageTopbarEnd : ""}`}
            >
              {source === "sample-shelf" || source === "sample-conveyor" ? <span>{sourceLabel(source)}</span> : null}
              <button
                ref={source === "camera" ? demoTriggerRef : undefined}
                className={styles.demoTrigger}
                type="button"
                onClick={source === "camera" ? openDemo : startCamera}
                aria-label={source === "camera" ? "Show demo" : "Back to live camera"}
              >
                {source === "camera" ? <Layers3 aria-hidden="true" size={17} /> : <Camera aria-hidden="true" size={17} />}
                {source === "camera" ? "Show demo" : "Back to live"}
              </button>
            </div>

            <div
              ref={stageRef}
              className={`${styles.cameraViewport} ${source === "camera" || source === "upload" ? styles.cameraViewportMediaRatio : ""}`}
              data-testid="camera-viewport"
              style={source === "camera" || source === "upload"
                ? ({
                    "--camera-media-aspect": mediaDimensions
                      ? `${mediaDimensions.width} / ${mediaDimensions.height}`
                      : "3 / 4"
                  } as CSSProperties)
                : undefined}
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
                onResize={(event) =>
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
                ? ["camera", "upload"].includes(source)
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
                  aria-label={`Open ${displayName}: ${presentation.label}`}
                >
                  <span>
                    <OverlayToneIcon tone={presentation.tone} />
                    <strong>{presentation.label}</strong>
                  </span>
                </button>
              );
            })}

            <div
              className={`${styles.stageStatus} ${visibleTrayIds.length > 0 && ["matched", "retained"].includes(recognitionState) ? styles.stageStatusResultHidden : ""}`}
              role="status"
              aria-live="polite"
            >
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
            </div>
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
                            ? "Matching products…"
                            : "Products identified · No verified nutrition"}
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
                              imageUrl={item?.imageUrl || scanOfferForId(id)?.imageUrl}
                              sceneImageUrl={sceneImageUrl}
                              sceneDimensions={mediaDimensions}
                              detection={detection}
                              sizes="42px"
                              targetAspect={42 / 54}
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
                            <CompactProductPrice detection={detection} offer={scanOfferForId(id)} />
                          </div>
                        </button>
                        {cheaperOffer ? (
                          <a
                            className={styles.sheetPreviewBuy}
                            href={cheaperOffer.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Buy ${item?.shortName || detection?.identity?.name || "product"} cheaper at ${cheaperOffer.retailer} for €${cheaperOffer.price.toFixed(2)}`}
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
                              ? "Matching product…"
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
                          {ratedCount > 0 ? "Best fit first" : pendingProductIds.size ? "Matching products" : "Products identified"}
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
                          const onlineOffer = scanOfferForId(id);
                          const protein = item?.nutrientsPer100g.proteinG;
                          const sugar = item?.nutrientsPer100g.totalSugarG;
                          return (
                            <li className={`${styles.rankedProductCard} ${effectiveSelectedId === id ? styles.activeRankedProductCard : ""}`} key={id}>
                              <button
                                type="button"
                                aria-label={
                                  isRated && presentation
                                    ? `Rank ${rank}, ${itemBrand} ${itemName}, ${presentation.label}`
                                    : `${itemBrand} ${itemName}, nutrition not verified online`
                                }
                                className={`${styles.rankedProduct} ${effectiveSelectedId === id ? styles.activeRankedProduct : ""}`}
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
                                    imageUrl={item?.imageUrl || onlineOffer?.imageUrl}
                                    sceneImageUrl={sceneImageUrl}
                                    sceneDimensions={mediaDimensions}
                                    detection={detection}
                                    sizes="48px"
                                    targetAspect={48 / 60}
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
                                  <CompactProductPrice detection={detection} offer={onlineOffer} />
                                </div>
                              </button>
                              <OnlineOfferAction
                                productName={itemName}
                                detection={detection}
                                offer={onlineOffer}
                                onRetailer={() => track("retailer_link_clicked", source, id, { placement: "ranked_product" })}
                              />
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  ) : null}

                  {selectedPayload ? (
                    <ProductResult
                      payload={selectedPayload}
                      detection={selectedDetection}
                      offer={effectiveSelectedId ? scanOfferForId(effectiveSelectedId) : null}
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
