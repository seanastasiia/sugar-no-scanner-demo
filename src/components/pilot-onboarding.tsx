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
            Point your camera at several products at once. Sugar.no compares similar items using verified total sugar, protein and product data.
          </p>
        </div>

        <div className={styles.onboardingNote}>
          <p>Camera frames are processed to identify products and are not saved.</p>
          <p>Products without confirmed data stay unrated.</p>
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
