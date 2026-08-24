"use client";

import Image from "next/image";
import {
  ArrowUpRight,
  ArrowDown,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
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
  mapBoxToObjectCover,
  remapRecognitionFromCrop,
  type MediaDimensions
} from "@/lib/camera-focus";
import {
  globalBestProductId,
  matchCriteria,
  matchToneLabel,
  overlayMatchPresentation,
  partialNutritionExplanation,
  type MatchTone,
  type SignalCompleteness
} from "@/lib/match-presentation";
import { dedupeProductDetections } from "@/lib/product-detection-dedupe";
import { hasSugarNoRating } from "@/lib/rating-visibility";
import { compareFairCohorts } from "@/lib/scoring";
import type {
  ProductDetection,
  RecognitionResponse,
  ScanSource,
  ScoredProduct
} from "@/lib/types";
import styles from "./scanner-app.module.css";

interface ProductPayload {
  product: ScoredProduct;
  alternatives: ScoredProduct[];
}

type CameraState = "idle" | "requesting" | "live" | "denied" | "error";
type RecognitionState = "idle" | "scanning" | "matched" | "retained" | "not_sure" | "unavailable" | "rate_limited" | "error";

const shelfIds = [
  "prot-bat-sal-riekst-saldin-barebells-55-g",
  "prot-bat-barebells-lemon-cheesecake-55-g",
  "proteina-bat-cepuma-garsa-iconfit-55-g",
  "proteina-baton-barebells-coco-choco-55-g"
];

const checkoutIds = shelfIds;

function makeSessionId() {
  return crypto.randomUUID();
}

function retryAfterSeconds(value: string | null): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 30;
}

async function imageFileToDataUrl(file: File): Promise<string> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = document.createElement("img");
    image.decoding = "async";
    image.src = sourceUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image could not be decoded"));
    });

    let scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    let dataUrl = "";
    do {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image canvas is unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL("image/jpeg", 0.78);
      scale *= 0.8;
    } while (dataUrl.length > 2_650_000 && scale > 0.25);

    if (dataUrl.length > 2_650_000) throw new Error("Image remains too large after resizing");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
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
  const inFlightRef = useRef(false);
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready when you are");
  const [resultLocked, setResultLocked] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [stageDimensions, setStageDimensions] = useState<MediaDimensions | null>(null);
  const [mediaDimensions, setMediaDimensions] = useState<MediaDimensions | null>(null);
  const [networkOnline, setNetworkOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

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

  const pauseRecognitionLoop = useCallback(() => {
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
            const provisionalDetections = dedupeProductDetections(provisional.detections);
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
      const uniqueDetections = dedupeProductDetections(result.detections);
      const needsShelfCompletionRetry =
        eventSource === "camera" && !focusMode && uniqueDetections.length === 1 && !shelfCompletionRetryRef.current;
      setRecognitionState(needsShelfCompletionRetry ? "scanning" : "matched");
      setDetections(uniqueDetections);
      const ids = uniqueDetections.map((detection) => detection.productId);
      const catalogIds = uniqueDetections
        .map(
          (detection) =>
            detection.catalogProductId ||
            (detection.identity?.matchKind === "barbora" ? detection.productId : null) ||
            (detection.identity ? null : detection.productId)
        )
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
      setResultsExpanded(false);
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
    },
    [hydrateProducts, pauseRecognitionLoop, track]
  );

  const recognize = useCallback(
    async (payload: { source: ScanSource; imageDataUrl?: string; sampleFrame?: number; focusMode?: boolean }) => {
      if (inFlightRef.current || !navigator.onLine) return;
      inFlightRef.current = true;
      setRecognitionState("scanning");
      setStatusMessage("Reading visible products…");
      try {
        const response = await fetch("/api/recognize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
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
        applyRecognition(
          payload.focusMode ? remapRecognitionFromCrop(result) : result,
          payload.source,
          Boolean(payload.focusMode)
        );
      } catch (error) {
        pauseRecognitionLoop();
        shelfCompletionRetryRef.current = false;
        setResultLocked(Boolean(provisionalResponseRef.current));
        setRecognitionState("error");
        setStatusMessage("The scan paused. Try again.");
        track("recognition_failed", payload.source, undefined, {
          message: error instanceof Error ? error.message : "unknown"
        });
      } finally {
        inFlightRef.current = false;
      }
    },
    [applyRecognition, pauseRecognitionLoop, track]
  );

  const stopActiveCapture = useCallback(() => {
    cameraRequestRef.current += 1;
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
    const targetWidth = Math.min(sourceWidth, 960);
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
    void recognize({
      source: "camera",
      imageDataUrl: canvas.toDataURL("image/jpeg", 0.76),
      focusMode
    });
  }, [recognize]);

  const startCamera = useCallback(async () => {
    sessionIdRef.current = makeSessionId();
    stopActiveCapture();
    const requestId = cameraRequestRef.current;
    setSource("camera");
    setPreviewUrl(null);
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
      setStatusMessage("Point at several products and hold steady");
      track("scan_started", "camera");
      scanTimerRef.current = setInterval(captureStableFrame, 650);
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

  const scanAgain = useCallback(() => {
    if (source !== "camera") return;
    sessionIdRef.current = makeSessionId();
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
        scanTimerRef.current = setInterval(captureStableFrame, 650);
      })
      .catch(() => void startCamera());
  }, [captureStableFrame, source, startCamera, track]);

  const startShelf = useCallback(() => {
    sessionIdRef.current = makeSessionId();
    stopActiveCapture();
    setSource("sample-shelf");
    setPreviewUrl(null);
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
    void hydrateProducts(checkoutIds);
    void recognize({ source: "sample-conveyor" });
  }, [hydrateProducts, recognize, stopActiveCapture, track]);

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
      const result = await imageFileToDataUrl(file);
      setPreviewUrl(result);
      track("scan_started", "upload");
      void recognize({ source: "upload", imageDataUrl: result });
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

  const selectedPayload = selectedId ? products[selectedId] : undefined;
  const detectionById = useMemo(
    () => Object.fromEntries(detections.map((detection) => [detection.productId, detection])),
    [detections]
  );
  const selectedDetection = selectedId ? detectionById[selectedId] : undefined;
  const loadedTray = tray.map((id) => products[id]?.product).filter(Boolean) as ScoredProduct[];
  const hasScoredProducts = loadedTray.some((product) => product.matchScore !== null);
  const ratedDetections = useMemo(
    () =>
      detections.filter(
        (detection) => hasSugarNoRating(products[detection.productId]?.product)
      ),
    [detections, products]
  );
  const unratedDetectionCount = detections.length - ratedDetections.length;
  const fairComparison = useMemo(() => compareFairCohorts(loadedTray), [loadedTray]);
  const bestId = globalBestProductId(fairComparison);
  const ratedCount = ratedDetections.length;
  const sheetTitle = `${tray.length} ${tray.length === 1 ? "product" : "products"} · ${ratedCount} with Sugar.no fit`;
  const orderedTray = useMemo(
    () => [...new Set([selectedId, bestId, ...tray].filter((id): id is string => Boolean(id)))],
    [bestId, selectedId, tray]
  );
  const sheetPreviewIds = orderedTray.slice(0, 4);
  const displayedStatusMessage =
    recognitionState === "matched" && tray.length > 0 && loadingProductIds.length === 0
      ? `${tray.length} ${tray.length === 1 ? "product" : "products"} · ${ratedCount} with Sugar.no fit`
      : statusMessage;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (bestId && !manualSelectionRef.current) setSelectedId(bestId);
  }, [bestId]);

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
    if (!resultsExpanded) return;
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
  }, [closeResults, resultsExpanded]);

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
        <div className={styles.wordmark} aria-label="Sugar dot no">
          Sugar<span>.no</span>
        </div>
      </header>

      <section className={styles.experience} aria-label={`${sourceLabel(source)} scanner`}>
          <div
            ref={stageRef}
            className={`${styles.stage} ${tray.length ? styles.stageWithResults : ""}`}
            inert={resultsExpanded || demoOpen}
            aria-hidden={resultsExpanded || demoOpen || undefined}
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

            {source === "camera" || source === "upload" ? (
              <div className={styles.scanGuide} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
            ) : null}

            {detections.map((detection) => {
              const product = products[detection.productId]?.product;
              const presentation = overlayMatchPresentation(product);
              const displayName = product?.name || detection.identity?.name || detection.observedText || "product";
              const mappedBox = mediaDimensions && stageDimensions
                ? mapBoxToObjectCover(detection.box, mediaDimensions, stageDimensions)
                : detection.box;
              const isBest = bestId === detection.productId;
              return (
                <button
                  className={`${styles.detectionBox} ${toneClass(presentation.tone)} ${completenessClass(presentation.completeness)} ${selectedId === detection.productId ? styles.selectedBox : ""} ${isBest ? styles.bestBox : ""}`}
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
                  aria-label={`Open ${displayName}: ${presentation.label}, ${presentation.completenessLabel}${isBest ? ", best in this scan" : ""}`}
                >
                  <span>
                    <OverlayToneIcon tone={presentation.tone} />
                    <strong>{isBest ? `Best · ${presentation.label}` : presentation.label}</strong>
                    <small>{presentation.completenessLabel}</small>
                  </span>
                </button>
              );
            })}

            <div className={styles.stageTopbar}>
              <span>{sourceLabel(source)}</span>
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

            <div className={styles.stageStatus} role="status" aria-live="polite">
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
              {source === "camera" && (recognitionState === "unavailable" || recognitionState === "rate_limited") ? (
                <button className={styles.recognitionRetry} type="button" onClick={scanAgain}>
                  <RefreshCw aria-hidden="true" size={15} /> Try again
                </button>
              ) : null}
            </div>
            <p className={styles.privacyNoteStage}>Frames are analyzed, never stored.</p>
          </div>

          {tray.length ? (
            <aside
              ref={resultsSheetRef}
              className={`${styles.resultsSheet} ${resultsExpanded ? styles.resultsExpanded : styles.resultsCollapsed}`}
              role={resultsExpanded ? "dialog" : undefined}
              aria-modal={resultsExpanded ? "true" : undefined}
              aria-label="Products from this scan"
              tabIndex={resultsExpanded ? -1 : undefined}
            >
              <div className={styles.sheetChrome}>
                {resultsExpanded ? (
                  <>
                    <button
                      className={styles.sheetIconButton}
                      type="button"
                      onClick={closeResults}
                      aria-label="Return to camera"
                    >
                      <ChevronDown aria-hidden="true" size={20} />
                    </button>
                    <div className={styles.sheetTitleStatic}>
                      <strong>{sheetTitle}</strong>
                      <span>Full comparison</span>
                    </div>
                    <button
                      className={styles.sheetIconButton}
                      type="button"
                      onClick={closeResults}
                      aria-label="Collapse product results"
                    >
                      <ChevronUp aria-hidden="true" size={20} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className={styles.sheetTitleStatic}>
                      <strong>{sheetTitle}</strong>
                      <span>Best available result first</span>
                    </div>
                    <div className={styles.sheetActions}>
                      <button type="button" onClick={openResults} aria-controls="scan-results-content">
                        <List aria-hidden="true" size={17} /> View all
                      </button>
                      <button type="button" onClick={source === "camera" ? scanAgain : startCamera}>
                        <RefreshCw aria-hidden="true" size={17} /> Scan again
                      </button>
                    </div>
                  </>
                )}
              </div>

              {!resultsExpanded ? (
                <div className={styles.sheetPreview} aria-label="Product result preview">
                  {sheetPreviewIds.map((id) => {
                    const item = products[id]?.product;
                    const detection = detectionById[id];
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
                          onClick={() => {
                            manualSelectionRef.current = true;
                            setSelectedId(id);
                            openResults();
                            track("result_opened", source, id);
                          }}
                        >
                          <div className={styles.sheetPreviewThumb} aria-hidden="true">
                            {item?.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="42px" /> : null}
                          </div>
                          <div className={styles.sheetPreviewCopy}>
                            <span>{item?.brand || detection?.identity?.brand || "Product"}</span>
                            {item && hasSugarNoRating(item) ? (
                              <MatchPill product={item} />
                            ) : (
                              <small>{loadingProductIds.includes(id) ? "Checking nutrition…" : "Identified"}</small>
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
                  <div className={styles.scanSummary}>
                    <div>
                      <strong>
                        {tray.length} unique {tray.length === 1 ? "product" : "products"} recognized
                      </strong>
                      <span>{resultLocked ? "Result held while you read" : "Tap a marker or swipe the products"}</span>
                    </div>
                    <button
                      className={styles.scanAgainButton}
                      type="button"
                      onClick={source === "camera" ? scanAgain : startCamera}
                    >
                        <RefreshCw aria-hidden="true" size={16} /> Scan again
                    </button>
                    {hasScoredProducts ? (
                      <>
                        <div className={styles.summarySignals} aria-label="Shelf marker legend">
                          <span className={styles.toneStrong}><Check aria-hidden="true" size={13} /> {matchToneLabel("strong")}</span>
                          <span className={styles.toneMiddle}><Minus aria-hidden="true" size={13} /> {matchToneLabel("middle")}</span>
                          <span className={styles.toneLower}><ArrowDown aria-hidden="true" size={13} /> {matchToneLabel("lower")}</span>
                        </div>
                        <p className={styles.markerScopeNote}>
                          Solid outlines use all 3 signals; dashed outlines show a partial fit.
                          {unratedDetectionCount > 0 ? ` ${unratedDetectionCount} identified package${unratedDetectionCount === 1 ? "" : "s"} stay neutral.` : ""}
                        </p>
                      </>
                    ) : (
                      <div className={styles.ratingNotice}>
                        <Info aria-hidden="true" size={15} />
                        <span>
                          <strong>No Sugar.no fit yet.</strong> {detections.length} {detections.length === 1 ? "package is" : "packages are"} still shown with a neutral outline.
                        </span>
                      </div>
                    )}
                  </div>

                  {tray.length > 1 ? (
                    <div className={styles.tray} aria-label="Products in this scan">
                      {orderedTray.map((id) => {
                        const item = products[id]?.product;
                        const detection = detectionById[id];
                        return (
                          <button
                            type="button"
                            key={id}
                            className={selectedId === id ? styles.activeTrayItem : ""}
                            onClick={() => {
                              manualSelectionRef.current = true;
                              setSelectedId(id);
                              track("result_opened", source, id);
                            }}
                          >
                            <span>{item?.brand || detection?.identity?.brand || "Reading"}</span>
                            {item ? (
                              <MatchPill product={item} />
                            ) : (
                              <small>{loadingProductIds.includes(id) ? "Checking nutrition…" : "Identified"}</small>
                            )}
                            <CompactProductPrice detection={detection} />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {selectedPayload ? (
                    <ProductResult
                      payload={selectedPayload}
                      detection={selectedDetection}
                      onAlternative={(id) => {
                        manualSelectionRef.current = true;
                        setSelectedId(id);
                        if (!products[id]) void hydrateProducts([id]);
                        track("alternative_viewed", source, id);
                      }}
                      onRetailer={(id) => track("retailer_link_clicked", source, id)}
                    />
                  ) : selectedDetection?.identity && selectedId && loadingProductIds.includes(selectedId) ? (
                    <LoadingProductResult detection={selectedDetection} />
                  ) : selectedDetection?.identity ? (
                    <RecognizedProductResult
                      detection={selectedDetection}
                      onRetailer={() => track("retailer_link_clicked", source, selectedDetection.productId, { placement: "recognized_product" })}
                    />
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
    <div className={styles.checkoutScene} aria-label="Real supermarket checkout belt sample with four supported protein snacks">
      <Image
        className={styles.samplePhoto}
        src="/samples/latvia-checkout.jpg"
        alt="Four protein bars on a supermarket checkout conveyor belt beside a cashier"
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
  detection,
  onAlternative,
  onRetailer
}: {
  payload: ProductPayload;
  detection?: ProductDetection;
  onAlternative: (id: string) => void;
  onRetailer: (id: string) => void;
}) {
  const { product, alternatives } = payload;
  return (
    <article className={styles.productResult}>
      <div className={styles.productHeading}>
        <div>
          <p className={styles.productBrand}>{product.brand}</p>
          <h2>{product.shortName}</h2>
        </div>
      </div>

      {detection?.shelfPrice ? (
        <PriceComparison detection={detection} onRetailer={() => onRetailer(product.id)} />
      ) : null}

      {product.ratingSignalCount > 0 ? <SugarNoBadge product={product} /> : null}

      {product.ratingStatus === "identity_only" ? (
        <div className={styles.pendingData}>
          <Info aria-hidden="true" size={18} />
          <span>
            <strong>Identified, not rated</strong>
            This product does not have a source-backed protein, fiber or sugar signal yet. Missing values are not invented.
          </span>
        </div>
      ) : null}

      {product.ratingStatus === "limited_signal" ? (
        <div className={styles.pendingData}>
          <ScanLine aria-hidden="true" size={18} />
          <span>
            <strong>Limited view · 1 of 3 signals</strong>
            Sugar.no shows the verified signal, but does not turn one nutrient into an overall fit.
          </span>
        </div>
      ) : null}

      {product.matchReason === "partial_nutrition" ? (
        <div className={styles.pendingData}>
          <Info aria-hidden="true" size={18} />
          <span>
            <strong>Quick view · 2 of 3 signals</strong>
            {partialNutritionExplanation(product.ratingSignalMask)}
          </span>
        </div>
      ) : null}

      {product.noAddedSugarClaim ? (
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
            {alternatives.map((alternative) => (
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
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!(detection?.shelfPrice && detection.retailerOffer?.exactSku) ? (
        <a
          className={styles.retailerButton}
          href={product.retailerUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onRetailer(product.id)}
        >
          <span>
            <small>Available online</small>
            View at Barbora · check current price
          </span>
          <ArrowUpRight aria-hidden="true" size={19} />
        </a>
      ) : null}
    </article>
  );
}

function RecognizedProductResult({
  detection,
  onRetailer
}: {
  detection: ProductDetection;
  onRetailer: () => void;
}) {
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
          <Check aria-hidden="true" size={15} /> Identified
        </span>
      </div>

      {detection.shelfPrice ? <PriceComparison detection={detection} onRetailer={onRetailer} /> : null}

      <div className={styles.pendingData}>
        <Info aria-hidden="true" size={18} />
        <span>
          <strong>Product recognized</strong>
          Sugar.no nutrition is not verified for this product yet, so no health or Match score is invented.
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
          <strong>Checking nutrition…</strong>
          Reading the exact Barbora page. Sugar.no will show a result only when the source lists enough data.
        </span>
      </div>
    </article>
  );
}

function PriceComparison({ detection, onRetailer }: { detection: ProductDetection; onRetailer: () => void }) {
  const shelfPrice = detection.shelfPrice;
  if (!shelfPrice) return null;
  const offer = detection.retailerOffer?.exactSku ? detection.retailerOffer : null;
  const cheaperOnline = Boolean(offer && offer.price < shelfPrice.amount);
  const savings = cheaperOnline && offer ? shelfPrice.amount - offer.price : 0;
  const checkedTime = offer
    ? new Date(offer.checkedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section
      className={`${styles.priceComparison} ${cheaperOnline ? styles.priceComparisonDeal : ""}`}
      aria-label="Price comparison"
    >
      <div className={styles.priceHeading}>
        <span>{cheaperOnline ? "Cheaper at Barbora" : offer ? "Barbora price check" : "Shelf price"}</span>
        {savings > 0 ? <strong>€{savings.toFixed(2)} less</strong> : null}
      </div>
      <div className={styles.priceValues}>
        <div>
          <small>Scanned shelf label</small>
          <strong className={cheaperOnline ? styles.crossedPrice : ""}>€{shelfPrice.amount.toFixed(2)}</strong>
        </div>
        {offer ? (
          <div>
            <small>Barbora online</small>
            <strong>€{offer.price.toFixed(2)}</strong>
          </div>
        ) : null}
      </div>
      {offer ? (
        <>
          <p>
            Matched by package identity
            {checkedTime ? ` · checked ${checkedTime}` : ""}
          </p>
          <a
            className={styles.retailerButton}
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onRetailer}
          >
            <span>
              <small>Current online offer</small>
              {cheaperOnline ? "Buy cheaper at Barbora" : "View at Barbora"} · €{offer.price.toFixed(2)}
            </span>
            <ArrowUpRight aria-hidden="true" size={19} />
          </a>
        </>
      ) : (
        <p>No exact online match. The camera-read shelf price is shown without a retailer link.</p>
      )}
    </section>
  );
}

function CompactProductPrice({ detection }: { detection?: ProductDetection }) {
  const shelfPrice = detection?.shelfPrice;
  if (!shelfPrice) return null;
  const offer = detection.retailerOffer?.exactSku ? detection.retailerOffer : null;
  const cheaperAtBarbora = Boolean(offer && offer.price < shelfPrice.amount);
  const accessibleLabel = cheaperAtBarbora && offer
    ? `Shelf price €${shelfPrice.amount.toFixed(2)}, Barbora €${offer.price.toFixed(2)}, cheaper at Barbora`
    : `Shelf price €${shelfPrice.amount.toFixed(2)}`;

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
  const values = {
    protein: product.nutrientsPer100g.proteinG,
    fiber: product.nutrientsPer100g.fiberG,
    sugar: product.nutrientsPer100g.totalSugarG
  };
  return (
    <section className={styles.sugarBadge} aria-label="Sugar.no badge">
      <div className={styles.sugarBadgeHeading}>
        <div>
          <small>{product.ratingBasis.startsWith("catalog_") ? "Sugar.no badge" : "Exact Barbora nutrition"}</small>
          <strong>
            {product.ratingStatus === "complete"
              ? "Sugar.no fit"
              : product.ratingStatus === "partial_overall"
                ? "Sugar.no quick view · 2/3"
                : "Sugar.no limited view · 1/3"}
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
          : `Values per ${product.nutritionBasis === "100ml" ? "100 ml" : "100 g"} · ${product.ratingSignalCount} of 3 source-backed signals`}
      </p>
    </section>
  );
}

function MatchPill({ product }: { product: ScoredProduct }) {
  const presentation = overlayMatchPresentation(product);
  return (
    <em className={`${styles.matchPill} ${toneClass(presentation.tone)}`}>
      {presentation.label}
      {product.ratingSignalCount > 0 && product.ratingSignalCount < 3 ? ` · ${product.ratingSignalCount}/3` : ""}
    </em>
  );
}
