"use client";

import Image from "next/image";
import {
  ArrowUpRight,
  Camera,
  Check,
  ChevronRight,
  CircleAlert,
  FileImage,
  Info,
  Layers3,
  LoaderCircle,
  Lock,
  RefreshCw,
  ScanLine,
  ShoppingBasket,
  Sparkles,
  X
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeDetectionTray } from "@/lib/dedupe";
import { matchCriteria, overallMatchPresentation, type MatchTone } from "@/lib/match-presentation";
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
type RecognitionState = "idle" | "scanning" | "matched" | "not_sure" | "unavailable" | "error";

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

export function ScannerApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const seenRef = useRef(new Map<string, number>());
  const trayRef = useRef<string[]>([]);
  const lowResFrameRef = useRef<Uint8ClampedArray | null>(null);
  const lastCaptureRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  const [source, setSource] = useState<ScanSource>("camera");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [recognitionState, setRecognitionState] = useState<RecognitionState>("idle");
  const [detections, setDetections] = useState<ProductDetection[]>([]);
  const [tray, setTray] = useState<string[]>([]);
  const [products, setProducts] = useState<Record<string, ProductPayload>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready when you are");
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
    const uniqueIds = [...new Set(ids)];
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
  }, []);

  const applyRecognition = useCallback(
    (result: RecognitionResponse, eventSource: ScanSource) => {
      if (result.status === "provider_unavailable") {
        setRecognitionState("unavailable");
        setStatusMessage("Live recognition needs the Gemini key. Sample scenes still work.");
        return;
      }
      if (result.status !== "matched" || result.detections.length === 0) {
        setRecognitionState("not_sure");
        setDetections([]);
        setStatusMessage("Not sure — point closer");
        return;
      }
      setRecognitionState("matched");
      setDetections(result.detections);
      const ids = result.detections.map((detection) => detection.productId);
      const merged = mergeDetectionTray(trayRef.current, seenRef.current, ids, Date.now());
      seenRef.current = merged.seen;
      trayRef.current = merged.tray;
      setStatusMessage(
        eventSource === "sample-conveyor"
          ? `${result.detections.length} supported products found on checkout`
          : result.detections.length === 1
            ? "1 supported product found"
            : `${result.detections.length} supported products found`
      );
      setTray(merged.tray);
      setSelectedId((current) => current || ids[0]);
      void hydrateProducts([...ids, ...merged.tray]);
      track("scan_completed", eventSource, ids[0], {
        count: ids.length,
        latencyMs: result.latencyMs,
        model: result.model,
        minConfidence: Math.min(...result.detections.map((detection) => detection.confidence)),
        meanConfidence:
          result.detections.reduce((sum, detection) => sum + detection.confidence, 0) /
          result.detections.length
      });
    },
    [hydrateProducts, track]
  );

  const recognize = useCallback(
    async (payload: { source: ScanSource; imageDataUrl?: string; sampleFrame?: number }) => {
      if (inFlightRef.current || !navigator.onLine) return;
      inFlightRef.current = true;
      setRecognitionState("scanning");
      setStatusMessage("Reading the package…");
      try {
        const response = await fetch("/api/recognize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Recognition returned ${response.status}`);
        applyRecognition((await response.json()) as RecognitionResponse, payload.source);
      } catch (error) {
        setRecognitionState("error");
        setStatusMessage("The scan paused. Try again.");
        track("recognition_failed", payload.source, undefined, {
          message: error instanceof Error ? error.message : "unknown"
        });
      } finally {
        inFlightRef.current = false;
      }
    },
    [applyRecognition, track]
  );

  const stopActiveCapture = useCallback(() => {
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    streamRef.current?.getTracks().forEach((trackItem) => trackItem.stop());
    streamRef.current = null;
    lowResFrameRef.current = null;
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
    const targetWidth = Math.min(video.videoWidth || 960, 960);
    canvas.width = targetWidth;
    canvas.height = Math.round(targetWidth * ((video.videoHeight || 1280) / (video.videoWidth || 960)));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    void recognize({ source: "camera", imageDataUrl: canvas.toDataURL("image/jpeg", 0.72) });
  }, [recognize]);

  const startCamera = useCallback(async () => {
    sessionIdRef.current = makeSessionId();
    stopActiveCapture();
    setSource("camera");
    setPreviewUrl(null);
    setCameraState("requesting");
    setDetections([]);
    setStatusMessage("Waiting for camera permission…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1920 }
        },
        audio: false
      });
      streamRef.current = stream;
      for (let attempt = 0; attempt < 10 && !videoRef.current; attempt += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      if (!videoRef.current) throw new Error("Camera preview is not ready");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraState("live");
      setRecognitionState("idle");
      setStatusMessage("Hold a supported product in the frame");
      track("scan_started", "camera");
      scanTimerRef.current = setInterval(captureStableFrame, 650);
    } catch (error) {
      const denied = error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name);
      setCameraState(denied ? "denied" : "error");
      setStatusMessage(
        denied ? "Camera access is off. Allow it in Safari settings or use a sample." : "Camera could not start."
      );
      if (denied) track("permission_denied", "camera");
    }
  }, [captureStableFrame, stopActiveCapture, track]);

  const startShelf = useCallback(() => {
    sessionIdRef.current = makeSessionId();
    stopActiveCapture();
    setSource("sample-shelf");
    setPreviewUrl(null);
    setCameraState("idle");
    setDetections([]);
    setTray([]);
    trayRef.current = [];
    setSelectedId(null);
    seenRef.current = new Map();
    track("scan_started", "sample-shelf");
    void hydrateProducts(shelfIds);
    void recognize({ source: "sample-shelf" });
  }, [hydrateProducts, recognize, stopActiveCapture, track]);

  const startCheckout = useCallback(() => {
    sessionIdRef.current = makeSessionId();
    stopActiveCapture();
    setSource("sample-conveyor");
    setPreviewUrl(null);
    setCameraState("idle");
    setDetections([]);
    setTray([]);
    trayRef.current = [];
    setSelectedId(null);
    seenRef.current = new Map();
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
    setCameraState("idle");
    setDetections([]);
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

  useEffect(() => () => stopActiveCapture(), [stopActiveCapture]);

  const selectedPayload = selectedId ? products[selectedId] : undefined;
  const loadedTray = tray.map((id) => products[id]?.product).filter(Boolean) as ScoredProduct[];
  const bestId = useMemo(() => {
    const scored = loadedTray.filter((product) => product.matchScore !== null);
    return scored.sort((left, right) => (right.matchScore ?? -1) - (left.matchScore ?? -1))[0]?.id;
  }, [loadedTray]);
  const activeExperience =
    cameraState !== "idle" || source !== "camera" || previewUrl || detections.length > 0 || tray.length > 0;

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <div className={styles.wordmark} aria-label="Sugar dot no">
          Sugar<span>.no</span>
        </div>
        <div className={styles.privateBadge}>
          <Lock aria-hidden="true" size={14} /> Private demo
        </div>
      </header>

      {!activeExperience ? (
        <section className={styles.intro} aria-labelledby="intro-title">
          <div className={styles.introIcon} aria-hidden="true">
            <ScanLine size={28} />
          </div>
          <p className={styles.eyebrow}>40 Latvia protein snacks</p>
          <h1 id="intro-title">
            One camera.
            <br />A <em>clearer</em> shelf.
          </h1>
          <p className={styles.introCopy}>
            See protein, fiber and total sugar together. No food rules and no “good versus bad”.
          </p>
          <button className={styles.primaryButton} type="button" onClick={startCamera}>
            <Camera aria-hidden="true" size={20} />
            Start live camera
          </button>
          <div className={styles.demoDivider}>
            <span>or try the guaranteed demo</span>
          </div>
          <div className={styles.demoGrid}>
            <button type="button" onClick={startShelf}>
              <Layers3 aria-hidden="true" size={21} />
              <span>
                <strong>Shelf photo</strong>
                Highlight four products
              </span>
              <ChevronRight aria-hidden="true" size={18} />
            </button>
            <button type="button" onClick={startCheckout}>
              <ShoppingBasket aria-hidden="true" size={21} />
              <span>
                <strong>Checkout photo</strong>
                Scan the whole belt
              </span>
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>
          <label className={styles.uploadButton}>
            <FileImage aria-hidden="true" size={19} />
            Use a saved shelf or checkout photo
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} />
          </label>
          <p className={styles.privacyNote}>
            <Lock aria-hidden="true" size={15} /> Frames are analyzed, never stored by Sugar.no.
          </p>
        </section>
      ) : (
        <section className={styles.experience} aria-label={`${sourceLabel(source)} scanner`}>
          <div className={styles.stage}>
            {cameraState === "live" || cameraState === "requesting" ? (
              <video ref={videoRef} className={styles.video} playsInline muted autoPlay aria-label="Live camera preview" />
            ) : null}

            {source === "sample-shelf" ? (
              <ShelfScene products={products} />
            ) : null}

            {source === "sample-conveyor" ? (
              <CheckoutScene products={products} />
            ) : null}

            {source === "upload" && previewUrl ? (
              <Image
                className={styles.uploadPreview}
                src={previewUrl}
                alt="Uploaded product scene"
                fill
                sizes="100vw"
                unoptimized
              />
            ) : null}

            {cameraState === "denied" || cameraState === "error" ? (
              <div className={styles.cameraError} role="alert">
                <CircleAlert aria-hidden="true" size={30} />
                <strong>{cameraState === "denied" ? "Camera permission is off" : "Camera unavailable"}</strong>
                <span>{statusMessage}</span>
                <button type="button" onClick={startCamera}>
                  <RefreshCw aria-hidden="true" size={17} /> Try again
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
              const presentation = overallMatchPresentation(product?.matchScore ?? null);
              const overlayLabel = presentation.label.replace(" match", "");
              return (
                <button
                  className={`${styles.detectionBox} ${toneClass(presentation.tone)} ${selectedId === detection.productId ? styles.selectedBox : ""}`}
                  style={{
                    left: `${detection.box.x * 100}%`,
                    top: `${detection.box.y * 100}%`,
                    width: `${detection.box.width * 100}%`,
                    height: `${detection.box.height * 100}%`
                  }}
                  type="button"
                  key={`${detection.productId}-${detection.box.x}`}
                  onClick={() => {
                    setSelectedId(detection.productId);
                    track("result_opened", source, detection.productId);
                  }}
                  aria-label={`Open ${product?.name || detection.observedText}`}
                >
                  <span>
                    <small>Sugar.no</small>
                    <strong>{product ? overlayLabel : "Reading"}</strong>
                  </span>
                </button>
              );
            })}

            <div className={styles.stageTopbar}>
              <span>{sourceLabel(source)}</span>
              <button
                type="button"
                onClick={() => {
                  stopActiveCapture();
                  setSource("camera");
                  setCameraState("idle");
                  setRecognitionState("idle");
                  setDetections([]);
                  setTray([]);
                  trayRef.current = [];
                  setSelectedId(null);
                  setPreviewUrl(null);
                }}
                aria-label="Close scanner"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className={styles.stageStatus} role="status" aria-live="polite">
              {recognitionState === "scanning" ? (
                <LoaderCircle className={styles.spin} aria-hidden="true" size={17} />
              ) : recognitionState === "matched" ? (
                <Check aria-hidden="true" size={17} />
              ) : recognitionState === "not_sure" || recognitionState === "error" ? (
                <Info aria-hidden="true" size={17} />
              ) : (
                <ScanLine aria-hidden="true" size={17} />
              )}
              {networkOnline ? statusMessage : "Offline — recognition paused"}
            </div>
          </div>

          <div className={styles.resultsSheet}>
            {tray.length > 1 ? (
              <div className={styles.tray} aria-label="Products in this scan">
                {tray.map((id) => {
                  const item = products[id]?.product;
                  return (
                    <button
                      type="button"
                      key={id}
                      className={selectedId === id ? styles.activeTrayItem : ""}
                      onClick={() => {
                        setSelectedId(id);
                        track("result_opened", source, id);
                      }}
                    >
                      <span>{item?.brand || "Reading"}</span>
                      {item ? <MatchPill product={item} /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {selectedPayload ? (
              <ProductResult
                payload={selectedPayload}
                bestInScan={bestId === selectedPayload.product.id}
                checkout={source === "sample-conveyor"}
                onAlternative={(id) => {
                  setSelectedId(id);
                  if (!products[id]) void hydrateProducts([id]);
                  track("alternative_viewed", source, id);
                }}
                onRetailer={(id) => track("retailer_link_clicked", source, id)}
              />
            ) : (
              <div className={styles.emptyResult}>
                {recognitionState === "scanning" ? (
                  <>
                    <div className={styles.resultSkeleton} />
                    <div className={styles.resultSkeletonShort} />
                  </>
                ) : (
                  <>
                    <Sparkles aria-hidden="true" size={23} />
                    <strong>Point at the front of a package</strong>
                    <span>Sugar.no will only show a known product when confidence is high enough.</span>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function ShelfScene({ products }: { products: Record<string, ProductPayload> }) {
  return (
    <div className={styles.shelfScene} aria-label="Sample shelf photo with four supported protein snacks">
      {shelfIds.map((id) => {
        const product = products[id]?.product;
        return (
          <div className={styles.shelfProduct} key={id}>
            {product?.imageUrl ? (
              <Image src={product.imageUrl} alt={product.name} fill sizes="22vw" priority />
            ) : (
              <div className={styles.packagePlaceholder}>{product?.brand || "Sugar.no"}</div>
            )}
          </div>
        );
      })}
      <div className={styles.shelfRail} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function CheckoutScene({ products }: { products: Record<string, ProductPayload> }) {
  return (
    <div className={styles.checkoutScene} aria-label="Sample checkout photo with four supported protein snacks">
      <div className={styles.beltLines} aria-hidden="true" />
      {checkoutIds.map((id) => {
        const product = products[id]?.product;
        return (
          <div className={styles.checkoutProduct} key={id}>
            {product?.imageUrl ? (
              <Image src={product.imageUrl} alt={product.name} fill sizes="22vw" priority />
            ) : (
              <div className={styles.packagePlaceholder}>{product?.brand || "Sugar.no"}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProductResult({
  payload,
  bestInScan,
  checkout,
  onAlternative,
  onRetailer
}: {
  payload: ProductPayload;
  bestInScan: boolean;
  checkout: boolean;
  onAlternative: (id: string) => void;
  onRetailer: (id: string) => void;
}) {
  const { product, alternatives } = payload;
  return (
    <article className={styles.productResult}>
      <div className={styles.productHeading}>
        <div>
          <p>{product.brand}</p>
          <h2>{product.shortName}</h2>
        </div>
      </div>

      <SugarNoBadge product={product} />

      {bestInScan && product.matchScore !== null ? (
        <div className={styles.bestBadge}>
          <Sparkles aria-hidden="true" size={15} />
          Best fit in this scan
        </div>
      ) : null}

      {product.matchScore === null ? (
        <div className={styles.pendingData}>
          <Info aria-hidden="true" size={18} />
          <span>
            <strong>Match pending</strong>
            Fiber is not yet confirmed by an independent source. Protein and total sugar remain visible.
          </span>
        </div>
      ) : null}

      <div className={styles.nutrients} aria-label="Nutrition per 100 grams">
        <Nutrient label="Protein" value={product.nutrientsPer100g.proteinG} unit="g" direction="Higher" />
        <Nutrient label="Fiber" value={product.nutrientsPer100g.fiberG} unit="g" direction="Higher" />
        <Nutrient label="Total sugar" value={product.nutrientsPer100g.totalSugarG} unit="g" direction="Lower" />
      </div>
      <p className={styles.perHundred}>Values per 100 g · Compared with protein snacks in this demo</p>

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
              <h3 id={`alternatives-${product.id}`}>
                {checkout ? "Save an option for your next shop" : "Compare without starting over"}
              </h3>
            </div>
          </div>
          <div className={styles.alternativeList}>
            {alternatives.map((alternative) => (
              <button type="button" key={alternative.id} onClick={() => onAlternative(alternative.id)}>
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
            ))}
          </div>
        </section>
      ) : null}

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
      <details className={styles.sources}>
        <summary>Data sources and limits</summary>
        <p>The badge compares these products with this demo category. It is not a medical or absolute health score.</p>
        <ul>
          {product.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.label}
              </a>{" "}
              · checked {source.checkedAt}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function SugarNoBadge({ product }: { product: ScoredProduct }) {
  const presentation = overallMatchPresentation(product.matchScore);
  const criteria = matchCriteria(product);
  return (
    <section className={styles.sugarBadge} aria-label="Sugar.no badge">
      <div className={styles.sugarBadgeHeading}>
        <strong>Sugar.no</strong>
        <span className={toneClass(presentation.tone)}>{presentation.label}</span>
      </div>
      <div className={styles.criteria}>
        {criteria.map((criterion) => (
          <div className={`${styles.criterion} ${toneClass(criterion.tone)}`} key={criterion.key}>
            <i aria-hidden="true" />
            <span>{criterion.label}</span>
            <strong>{criterion.status}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function MatchPill({ product }: { product: ScoredProduct }) {
  const presentation = overallMatchPresentation(product.matchScore);
  return <em className={`${styles.matchPill} ${toneClass(presentation.tone)}`}>{presentation.label}</em>;
}

function Nutrient({
  label,
  value,
  unit,
  direction
}: {
  label: string;
  value: number | null;
  unit: string;
  direction: string;
}) {
  return (
    <div className={styles.nutrient}>
      <span>{label}</span>
      <strong>{value === null ? "Not verified" : `${value}${unit}`}</strong>
      <small>{direction} supports this badge</small>
    </div>
  );
}
