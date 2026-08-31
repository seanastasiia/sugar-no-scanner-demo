"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Camera, ScanLine, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import styles from "./scanner-app.module.css";

export function PilotOnboarding({
  step,
  onStepChange,
  onComplete,
  onSkip
}: {
  step: 1 | 2;
  onStepChange: (step: 1 | 2) => void;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <section className={styles.onboarding} aria-labelledby="onboarding-title">
      <Image
        className={styles.onboardingLogo}
        src="/brand/sugar-no-logo-white.svg"
        alt="Sugar.no"
        width={137}
        height={26.07}
        priority
        unoptimized
      />
      <div className={styles.onboardingCard}>
        <div className={styles.onboardingProgress} aria-label={`Step ${step} of 2`}>
          <span className={styles.onboardingProgressActive} />
          <span className={step === 2 ? styles.onboardingProgressActive : undefined} />
        </div>

        {step === 1 ? (
          <>
            <div className={styles.onboardingIcon}><ScanLine aria-hidden="true" size={28} /></div>
            <p className={styles.onboardingEyebrow}>Compare with confidence</p>
            <h1 id="onboarding-title" ref={headingRef} tabIndex={-1}>Compare similar products</h1>
            <p className={styles.onboardingCopy}>
              Sugar.no compares similar products using verified total sugar, protein and product data.
            </p>
            <p className={styles.onboardingTrust}>
              <ShieldCheck aria-hidden="true" size={18} /> Products without enough confirmed data stay unrated.
            </p>
            <div className={styles.onboardingActions}>
              <button className={styles.primaryButton} type="button" onClick={() => onStepChange(2)}>
                Next <ArrowRight aria-hidden="true" size={19} />
              </button>
              <button className={styles.secondaryButton} type="button" onClick={onSkip}>Skip</button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.onboardingIcon}><Camera aria-hidden="true" size={28} /></div>
            <p className={styles.onboardingEyebrow}>Live shelf scan</p>
            <h1 id="onboarding-title" ref={headingRef} tabIndex={-1}>Point, compare, decide</h1>
            <p className={styles.onboardingCopy}>
              Point your camera at several products and hold it steady. Frames are processed for recognition, but Sugar.no does not save them.
            </p>
            <div className={styles.onboardingActions}>
              <button className={styles.primaryButton} type="button" onClick={onComplete}>
                <Camera aria-hidden="true" size={19} /> Open camera
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => onStepChange(1)}>
                <ArrowLeft aria-hidden="true" size={18} /> Back
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
