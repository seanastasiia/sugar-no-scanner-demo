"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./scanner-app.module.css";

export function PilotOnboarding({
  onComplete,
  onTrySample
}: {
  onComplete: () => void;
  onTrySample: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className={styles.onboarding} aria-labelledby="onboarding-title">
      <div className={styles.onboardingHeader}>
        <div className={styles.onboardingLogo} role="img" aria-label="Sugar.no">
          sugar<span>.no</span>
        </div>
      </div>
      <div className={styles.onboardingContent}>
        <figure className={styles.onboardingPreview} data-testid="onboarding-preview">
          <div className={styles.onboardingPreviewImage}>
            <Image
              src="/onboarding/shelf-scan.jpg"
              alt="Protein bars on a shop shelf. Four products are outlined and one is labelled Great fit."
              fill
              priority
              sizes="(max-width: 460px) calc(100vw - 40px), 420px"
            />
          </div>
          <figcaption className={styles.onboardingResult}>
            <span className={styles.onboardingResultCopy}>
              <strong>4 products compared</strong>
              <small>Best fit appears first</small>
            </span>
            <span className={styles.onboardingFit}>Great fit</span>
          </figcaption>
        </figure>

        <div className={styles.onboardingMain}>
          <h1 id="onboarding-title" ref={headingRef} tabIndex={-1}>
            Find a better fit.
          </h1>
          <p className={styles.onboardingCopy}>
            Point your camera at a shelf. We compare similar products by sugar and protein.
          </p>
        </div>

        <div className={styles.onboardingActions}>
          <button className={styles.onboardingPrimary} type="button" onClick={onComplete}>
            Open camera
          </button>
          <button className={styles.secondaryButton} type="button" onClick={onTrySample}>
            Try a sample shelf
          </button>
          <p className={styles.onboardingNote}>
            Camera opens only after you choose Open camera. Photos are not saved.
          </p>
        </div>
      </div>
    </section>
  );
}
