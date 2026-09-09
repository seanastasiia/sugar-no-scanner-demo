"use client";

import Image from "next/image";
import { ArrowLeft, Check, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ScannerHomeLogo } from "./scanner-home-logo";
import styles from "./selling-onboarding.module.css";

export function PilotOnboarding({
  onComplete,
  onTrySample,
  onSkip,
  onStepViewed,
  onPathSelected,
  onSampleRevealed
}: {
  onComplete: () => void;
  onTrySample: () => void;
  onSkip: (step: number) => void;
  onStepViewed: (step: number) => void;
  onPathSelected: (path: "sample" | "express") => void;
  onSampleRevealed: () => void;
}) {
  const [step, setStep] = useState(1);
  const [demoRevealed, setDemoRevealed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function goTo(nextStep: number) {
    setStep(nextStep);
    onStepViewed(nextStep);
  }

  return (
    <main className={styles.onboarding} aria-labelledby="selling-onboarding-title">
      <header className={styles.header}>
        {step > 1 ? (
          <button className={styles.iconButton} type="button" aria-label="Go back" onClick={() => goTo(step - 1)}>
            <ArrowLeft aria-hidden="true" size={21} />
          </button>
        ) : <span className={styles.headerSpacer} />}
        <ScannerHomeLogo imageClassName={styles.logo} priority />
        {step < 3 ? <button className={styles.skip} type="button" onClick={() => onSkip(step)}>Skip</button> : <span className={styles.headerSpacer} />}
      </header>

      <div className={styles.progress} aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map((item) => <span key={item} className={item <= step ? styles.progressActive : ""} />)}
      </div>

      {step === 1 ? (
        <section className={styles.screen}>
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>Sugar.no Shelf Scanner</p>
            <h1 id="selling-onboarding-title" ref={headingRef} tabIndex={-1}>Compare the shelf, not the labels.</h1>
            <p>We compare confirmed sugar and protein, then show your Sugar.no fit. No account.</p>
          </div>
          <ShelfPreview state="teaser" />
          <div className={styles.actions}>
            <button className={styles.primary} type="button" onClick={() => { onPathSelected("sample"); goTo(2); }}>Try it on this shelf</button>
            <button className={styles.secondary} type="button" onClick={() => { onPathSelected("express"); goTo(3); }}>Scan my shelf now</button>
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
          </div>
        </section>
      ) : null}
    </main>
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
