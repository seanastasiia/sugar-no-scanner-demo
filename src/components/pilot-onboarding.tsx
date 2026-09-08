"use client";

import Image from "next/image";
import { ArrowLeft, Check, ScanLine } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScannerHomeLogo } from "./scanner-home-logo";
import styles from "./selling-onboarding.module.css";

type Friction = "labels" | "language" | "compare";

const frictionOptions: Array<{ value: Friction; label: string }> = [
  { value: "labels", label: "Reading every label" },
  { value: "language", label: "Labels in another language" },
  { value: "compare", label: "Comparing similar products" }
];

const reflectionCopy: Record<Friction, string> = {
  labels: "You should not need to read every pack. We turn the shelf into one short comparison.",
  language: "You can compare the confirmed nutrition we have, even when the pack is hard to read.",
  compare: "We place similar products together and show the best Sugar.no fit first."
};

export function PilotOnboarding({
  onComplete,
  onTrySample,
  onSkip,
  onStepViewed
}: {
  onComplete: () => void;
  onTrySample: () => void;
  onSkip: (step: number) => void;
  onStepViewed: (step: number) => void;
}) {
  const [step, setStep] = useState(1);
  const [friction, setFriction] = useState<Friction | null>(null);
  const [demoRevealed, setDemoRevealed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const reflection = useMemo(() => reflectionCopy[friction || "compare"], [friction]);

  function goTo(nextStep: number) {
    setStep(nextStep);
    onStepViewed(nextStep);
  }

  return (
    <main className={styles.onboarding} aria-labelledby="selling-onboarding-title">
      <header className={styles.header}>
        {step > 1 ? (
          <button className={styles.iconButton} type="button" aria-label="Go back" onClick={() => setStep(step - 1)}>
            <ArrowLeft aria-hidden="true" size={21} />
          </button>
        ) : <span className={styles.headerSpacer} />}
        <ScannerHomeLogo imageClassName={styles.logo} priority />
        {step < 4 ? <button className={styles.skip} type="button" onClick={() => onSkip(step)}>Skip</button> : <span className={styles.headerSpacer} />}
      </header>

      <div className={styles.progress} aria-label={`Step ${step} of 4`}>
        {[1, 2, 3, 4].map((item) => <span key={item} className={item <= step ? styles.progressActive : ""} />)}
      </div>

      {step === 1 ? (
        <section className={styles.screen}>
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>Sugar.no Shelf Scanner</p>
            <h1 id="selling-onboarding-title" ref={headingRef} tabIndex={-1}>A faster way to choose from the shelf.</h1>
            <p>Point your camera at similar products. We compare confirmed sugar and protein data, then show the best fit first.</p>
          </div>
          <ShelfPreview revealed />
          <div className={styles.actions}>
            <button className={styles.primary} type="button" onClick={() => goTo(2)}>Show me how</button>
            <button className={styles.secondary} type="button" onClick={onTrySample}>Try a sample shelf</button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className={styles.screen}>
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>Make it yours</p>
            <h1 id="selling-onboarding-title" ref={headingRef} tabIndex={-1}>What slows you down most?</h1>
            <p>Choose the one that feels most familiar.</p>
          </div>
          <div className={styles.optionList} role="radiogroup" aria-label="What slows you down at the shelf">
            {frictionOptions.map((option) => (
              <button
                key={option.value}
                className={`${styles.option} ${friction === option.value ? styles.optionSelected : ""}`}
                type="button"
                role="radio"
                aria-checked={friction === option.value}
                onClick={() => setFriction(option.value)}
              >
                <span>{option.label}</span>
                <span className={styles.radio}>{friction === option.value ? <Check aria-hidden="true" size={16} /> : null}</span>
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <button className={styles.primary} type="button" disabled={!friction} onClick={() => goTo(3)}>Continue</button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className={styles.screen}>
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>Your first result</p>
            <h1 id="selling-onboarding-title" ref={headingRef} tabIndex={-1}>See the useful answer, not every label.</h1>
            <p>{reflection}</p>
          </div>
          <ShelfPreview revealed={demoRevealed} />
          <div className={styles.actions}>
            {!demoRevealed ? (
              <button className={styles.primary} type="button" onClick={() => setDemoRevealed(true)}><ScanLine aria-hidden="true" size={20} />Scan this shelf</button>
            ) : (
              <button className={styles.primary} type="button" onClick={() => goTo(4)}>That makes sense</button>
            )}
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className={styles.screen}>
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>Ready for your next shop</p>
            <h1 id="selling-onboarding-title" ref={headingRef} tabIndex={-1}>Your shelf shortcut is ready.</h1>
            <p>{reflection}</p>
          </div>
          <div className={styles.offerCard}>
            <div className={styles.offerIcon}><ScanLine aria-hidden="true" size={28} /></div>
            <div>
              <strong>Start with 3 free successful scans</strong>
              <p>After that, unlock unlimited scanning for 7 days for €2.99.</p>
            </div>
            <ul>
              <li><Check aria-hidden="true" size={16} />Live camera and photo upload</li>
              <li><Check aria-hidden="true" size={16} />Only successful results use a free scan</li>
              <li><Check aria-hidden="true" size={16} />One payment, no subscription</li>
            </ul>
          </div>
          <div className={styles.actions}>
            <button className={styles.primary} type="button" onClick={onComplete}>Start my 3 free scans</button>
            <p className={styles.privacy}>Camera opens after this tap. Photos are not saved.</p>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ShelfPreview({ revealed }: { revealed: boolean }) {
  return (
    <figure className={`${styles.preview} ${revealed ? styles.previewRevealed : ""}`} data-testid="onboarding-preview">
      <div className={styles.previewImage}>
        <Image
          src="/samples/latvia-shelf.jpg"
          alt="Protein bars on a shop shelf. After scanning, four products are outlined and the best fit appears first."
          fill
          priority
          sizes="(max-width: 460px) calc(100vw - 40px), 420px"
        />
        <div className={styles.scanLine} data-testid="onboarding-scan-line" aria-hidden="true" />
        {[1, 26, 51, 76].map((left, index) => (
          <span key={left} className={styles.productBox} style={{ left: `${left}%` }} aria-hidden="true">
            {index === 0 ? <span className={styles.fitBadge}>Great fit</span> : null}
          </span>
        ))}
      </div>
      <figcaption className={styles.previewResult} aria-live="polite">
        {revealed ? (
          <><span><strong>4 products compared</strong><small>Best Sugar.no fit appears first</small></span><span className={styles.fitBadge}>Great fit</span></>
        ) : (
          <><span><strong>Ready to scan</strong><small>Tap once to see the comparison</small></span><ScanLine aria-hidden="true" size={22} /></>
        )}
      </figcaption>
    </figure>
  );
}
