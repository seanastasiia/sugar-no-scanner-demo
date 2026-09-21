"use client";

import Image from "next/image";
import { ArrowRight, Bookmark, Copy, Send, Share2, ScanLine, Smartphone, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScannerHomeLogo } from "./scanner-home-logo";
import styles from "./selling-onboarding.module.css";

export function PilotOnboarding({
  onComplete,
  onTrySample,
  onPathSelected,
  onSampleRevealed,
  onSavePromptViewed,
  onSaveAction
}: {
  onComplete: () => void;
  onTrySample: () => void;
  onPathSelected: (path: "at_home" | "in_store") => void;
  onSampleRevealed: () => void;
  onSavePromptViewed: () => void;
  onSaveAction: (action: "shared" | "copied" | "dismissed" | "failed") => void;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [standalone] = useState(() => {
    if (typeof window === "undefined") return false;
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const saveTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function openSave() {
    setSaveOpen(true);
    onSavePromptViewed();
  }

  const closeSave = useCallback((action: "dismissed" | null = "dismissed") => {
    setSaveOpen(false);
    if (action) onSaveAction(action);
    window.requestAnimationFrame(() => saveTriggerRef.current?.focus());
  }, [onSaveAction]);

  return (
    <main className={styles.onboarding} aria-labelledby="selling-onboarding-title">
      <header className={styles.header}>
        <span className={styles.headerSpacer} />
        <ScannerHomeLogo imageClassName={styles.logo} priority />
        <span className={styles.headerSpacer} />
      </header>

      <section className={`${styles.screen} ${styles.firstScreen}`}>
        <div className={styles.copyBlock}>
          <h1 id="selling-onboarding-title" ref={headingRef} tabIndex={-1}>Find the better fit in one shelf photo.</h1>
          <p>Not at a shelf? Try this four-bar example now, or save the scanner for your next shop.</p>
        </div>
        <ShelfPreview state="result" />
        <div className={styles.actions}>
          <button className={styles.primary} type="button" onClick={() => {
            onPathSelected("at_home");
            onSampleRevealed();
            onTrySample();
          }}>See all 4 sample results<ArrowRight aria-hidden="true" size={20} /></button>
          <button className={styles.secondary} type="button" onClick={() => {
            onPathSelected("in_store");
            onComplete();
          }}><ScanLine aria-hidden="true" size={20} />Scan my shelf now</button>
          {!standalone ? (
            <button ref={saveTriggerRef} className={styles.textButton} type="button" onClick={() => {
              onPathSelected("at_home");
              openSave();
            }}><Bookmark aria-hidden="true" size={18} />Save for my next shop</button>
          ) : null}
          <p className={styles.offerSummary}><strong>3 successful scans free</strong> · then €2.99 once for 7 days · no subscription.</p>
          <p className={styles.privacy}>Camera starts only when you choose Scan my shelf now. Photos are not saved.</p>
        </div>
      </section>

      {saveOpen ? (
        <SaveForLaterDialog
          onClose={closeSave}
          onAction={onSaveAction}
        />
      ) : null}
    </main>
  );
}

function SaveForLaterDialog({
  onClose,
  onAction
}: {
  onClose: (action?: "dismissed" | null) => void;
  onAction: (action: "shared" | "copied" | "dismissed" | "failed") => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "working" | "copied" | "failed">("idle");
  const [showUrl, setShowUrl] = useState(false);
  const saveUrl = typeof window === "undefined" ? "" : `${window.location.origin}/?saved=1`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>("button:not([disabled]), input") || []);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function copyLink() {
    setStatus("working");
    try {
      await navigator.clipboard.writeText(saveUrl);
      setStatus("copied");
      onAction("copied");
    } catch {
      setStatus("failed");
      setShowUrl(true);
      onAction("failed");
    }
  }

  async function saveLink() {
    if (!canShare) {
      await copyLink();
      return;
    }
    setStatus("working");
    try {
      await navigator.share({
        title: "Sugar.no Shelf Scanner",
        text: "Save Sugar.no for your next shop.",
        url: saveUrl
      });
      onAction("shared");
      onClose(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("failed");
      onAction("failed");
    }
  }

  return (
    <div className={styles.sheetBackdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div ref={dialogRef} className={styles.saveSheet} role="dialog" aria-modal="true" aria-labelledby="save-sheet-title">
        <button className={styles.sheetClose} type="button" aria-label="Close" onClick={() => onClose()}>
          <X aria-hidden="true" size={21} />
        </button>
        <div className={styles.sheetIcon}><Share2 aria-hidden="true" size={26} /></div>
        <h2 id="save-sheet-title">Save it for your next shop</h2>
        <p>Send the scanner link to Messages, WhatsApp or Notes, then open it when you are in store.</p>
        <div className={styles.homeScreenHint}>
          <Smartphone aria-hidden="true" size={21} />
          <p><strong>Want one-tap access?</strong> Open the saved link in Safari or Chrome, then choose Add to Home Screen from the browser menu.</p>
        </div>
        <button className={styles.primary} type="button" disabled={status === "working"} onClick={() => void saveLink()}>
          {canShare ? <Send aria-hidden="true" size={19} /> : <Copy aria-hidden="true" size={19} />}
          {status === "working" ? "Opening…" : status === "copied" ? "Link copied" : canShare ? "Send the link to myself" : "Copy the link"}
        </button>
        {canShare ? <button className={styles.secondary} type="button" disabled={status === "working"} onClick={() => void copyLink()}><Copy aria-hidden="true" size={19} />Copy instead</button> : null}
        {showUrl ? (
          <label className={styles.urlFallback}>Copy this link manually<input readOnly value={saveUrl} onFocus={(event) => event.currentTarget.select()} /></label>
        ) : null}
        <p className={styles.sheetStatus} aria-live="polite">
          {status === "copied" ? "Saved. Open the link on your next shop." : status === "failed" ? "Sharing was unavailable. You can copy the link instead." : "No account, email or notification permission needed."}
        </p>
      </div>
    </div>
  );
}

function ShelfPreview({ state }: { state: "teaser" | "ready" | "result" }) {
  const annotated = state === "teaser" || state === "result";
  const result = state === "result";
  return (
    <figure className={`${styles.preview} ${annotated ? styles.previewAnnotated : ""} ${result ? styles.previewRevealed : ""}`} data-testid="onboarding-preview">
      <div className={styles.previewImage}>
        <Image
          src="/samples/latvia-shelf.jpg"
          alt="Protein bars on a shop shelf. After scanning, four products are outlined and ranked using confirmed sugar and protein data."
          fill
          priority
          sizes="(max-width: 460px) calc(100vw - 40px), 420px"
        />
        <div className={styles.scanLine} data-testid="onboarding-scan-line" aria-hidden="true" />
        {[1, 26, 51, 76].map((left, index) => (
          <span key={left} className={styles.productBox} style={{ left: `${left}%` }} aria-hidden="true">
            {result && index === 0 ? <span className={styles.fitBadge}>Great fit</span> : null}
          </span>
        ))}
      </div>
      <figcaption className={styles.previewResult} aria-live="polite">
        {result ? (
          <div className={styles.sampleRanking}>
            <span className={styles.rankNumber}>1</span>
            <span><strong>BAREBELLS Salty Peanut</strong><small>Sugar 2.3 g · Protein 36 g / 100 g</small></span>
          </div>
        ) : state === "teaser" ? (
          <><span><strong>4 products found</strong><small>Compare a sample shelf in one tap</small></span><ScanLine aria-hidden="true" size={22} /></>
        ) : (
          <><span><strong>Ready to scan</strong><small>Tap once to compare all four products</small></span><ScanLine aria-hidden="true" size={22} /></>
        )}
      </figcaption>
    </figure>
  );
}
