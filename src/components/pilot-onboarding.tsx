"use client";

import Image from "next/image";
import { ArrowLeft, Check, Copy, Send, Share2, ScanLine, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScannerHomeLogo } from "./scanner-home-logo";
import styles from "./selling-onboarding.module.css";

export function PilotOnboarding({
  onComplete,
  onTrySample,
  onSkip,
  onStepViewed,
  onPathSelected,
  onSampleRevealed,
  onSavePromptViewed,
  onSaveAction
}: {
  onComplete: () => void;
  onTrySample: () => void;
  onSkip: (step: number) => void;
  onStepViewed: (step: number) => void;
  onPathSelected: (path: "at_home" | "in_store") => void;
  onSampleRevealed: () => void;
  onSavePromptViewed: () => void;
  onSaveAction: (action: "shared" | "copied" | "dismissed" | "failed") => void;
}) {
  const [step, setStep] = useState(1);
  const [demoRevealed, setDemoRevealed] = useState(false);
  const [entryContext, setEntryContext] = useState<"at_home" | "in_store" | null>(null);
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
  }, [step]);

  function goTo(nextStep: number) {
    setStep(nextStep);
    onStepViewed(nextStep);
  }

  function goBack() {
    if (step === 3 && entryContext === "in_store") goTo(1);
    else goTo(step - 1);
  }

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
        {step > 1 ? (
          <button className={styles.iconButton} type="button" aria-label="Go back" onClick={goBack}>
            <ArrowLeft aria-hidden="true" size={21} />
          </button>
        ) : <span className={styles.headerSpacer} />}
        <ScannerHomeLogo imageClassName={styles.logo} priority />
        {step < 3 ? <button className={styles.skip} type="button" onClick={() => onSkip(step)}>Skip</button> : <span className={styles.headerSpacer} />}
      </header>

      <div
        className={styles.progress}
        role="progressbar"
        aria-label={`Step ${step} of 3`}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
      >
        {[1, 2, 3].map((item) => <span key={item} className={item <= step ? styles.progressActive : ""} />)}
      </div>

      {step === 1 ? (
        <section className={styles.screen}>
          <div className={styles.copyBlock}>
            <h1 id="selling-onboarding-title" ref={headingRef} tabIndex={-1}>Compare the shelf, not the labels.</h1>
            <p>We compare confirmed sugar and protein, then show your Sugar.no fit. No account.</p>
          </div>
          <ShelfPreview state="teaser" />
          <div className={styles.actions}>
            <button className={styles.primary} type="button" onClick={() => { setEntryContext("in_store"); onPathSelected("in_store"); goTo(3); }}>Scan the shelf in front of me</button>
            <button className={styles.secondary} type="button" onClick={() => { setEntryContext("at_home"); onPathSelected("at_home"); goTo(2); }}>Not shopping yet — show me a sample</button>
            <p className={styles.privacy}>Camera stays off until you tap Start my 3 free scans.</p>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className={styles.screen}>
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>A real sample result</p>
            <h1 id="selling-onboarding-title" ref={headingRef} tabIndex={-1}>The answer, not every label.</h1>
            <p>We rank only products with confirmed values and tell you when data is missing.</p>
          </div>
          <ShelfPreview state={demoRevealed ? "result" : "ready"} />
          <div className={styles.actions}>
            {!demoRevealed ? (
              <button className={styles.primary} type="button" onClick={() => { setDemoRevealed(true); onSampleRevealed(); }}><ScanLine aria-hidden="true" size={20} />Scan this shelf</button>
            ) : (
              <>
                <button className={styles.primary} type="button" onClick={() => goTo(3)}>Try my own shelf</button>
                <button className={styles.secondary} type="button" onClick={onTrySample}>Explore all 4 results</button>
              </>
            )}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className={styles.screen}>
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>Nothing to pay now</p>
            <h1 id="selling-onboarding-title" ref={headingRef} tabIndex={-1}>Start with 3 free scans.</h1>
            <p>A scan counts only when at least one product gets a Sugar.no fit. Unverified scans are free.</p>
            {entryContext === "at_home" ? <p className={styles.contextHint}>No shelf nearby? Upload a photo of anything in your cupboard.</p> : null}
          </div>
          <div className={styles.offerCard}>
            <div className={styles.offerIcon}><ScanLine aria-hidden="true" size={28} /></div>
            <div>
              <strong>Then €2.99 once for 7 days</strong>
              <p>Unlimited shelf scanning after your free scans. No subscription and no account.</p>
            </div>
            <ul>
              <li><Check aria-hidden="true" size={16} />Live camera and photo upload</li>
              <li><Check aria-hidden="true" size={16} />Failed and unverified scans do not count</li>
              <li><Check aria-hidden="true" size={16} />One payment, no recurring charge</li>
            </ul>
          </div>
          <div className={styles.actions}>
            <p className={styles.privacy}>The next tap opens your camera. Photos are not saved.</p>
            <button className={styles.primary} type="button" onClick={onComplete}>Start my 3 free scans</button>
            {entryContext === "at_home" && !standalone ? (
              <button ref={saveTriggerRef} className={styles.textButton} type="button" onClick={openSave}>Save it for my next shop</button>
            ) : null}
            {entryContext === "at_home" && !standalone ? <p className={styles.privacy}>No account, no emails, no notifications.</p> : null}
          </div>
        </section>
      ) : null}

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
            <span><strong>BAREBELLS Salty Peanut</strong><small>Sugar 2.3 g · Protein 36 g per 100 g</small></span>
            <span className={styles.fitBadge}>Great fit</span>
          </div>
        ) : state === "teaser" ? (
          <><span><strong>4 products found</strong><small>Tap to see the confirmed comparison</small></span><ScanLine aria-hidden="true" size={22} /></>
        ) : (
          <><span><strong>Ready to scan</strong><small>Tap once to compare all four products</small></span><ScanLine aria-hidden="true" size={22} /></>
        )}
      </figcaption>
    </figure>
  );
}
