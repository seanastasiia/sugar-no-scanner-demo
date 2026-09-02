"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./scanner-app.module.css";

export function PilotOnboarding({
  onComplete,
  onSkip
}: {
  onComplete: () => void;
  onSkip: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className={styles.onboarding} aria-labelledby="onboarding-title">
      <div className={styles.onboardingHeader}>
        <Image
          className={styles.onboardingLogo}
          src="/brand/sugar-no-logo-white.svg"
          alt="Sugar.no"
          width={137}
          height={26.07}
          priority
          unoptimized
        />
      </div>
      <div className={styles.onboardingContent}>
        <div className={styles.onboardingMain}>
          <h1 id="onboarding-title" ref={headingRef} tabIndex={-1}>
            Compare the whole shelf.
          </h1>
          <p className={styles.onboardingCopy}>
            Scan several products. See the best fit first.
          </p>
        </div>

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
          <figcaption>Example scan. Fit uses verified sugar and protein.</figcaption>
        </figure>

        <div className={styles.onboardingNote}>
          <p>Camera frames are processed, not saved.</p>
        </div>

        <div className={styles.onboardingActions}>
          <button className={styles.onboardingPrimary} type="button" onClick={onComplete}>
            Open camera
          </button>
          <button className={styles.secondaryButton} type="button" onClick={onSkip}>Skip</button>
        </div>
      </div>
    </section>
  );
}
