"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./scanner-app.module.css";

export function PilotOnboarding({ onComplete, onTrySample }: { onComplete: () => void; onTrySample: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className={styles.onboarding} aria-labelledby="onboarding-title">
      <div className={styles.onboardingHeader}>
        <div className={styles.onboardingBrand}>
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
      </div>
      <div className={styles.onboardingContent}>
        <div className={styles.onboardingMain}>
          <h1 id="onboarding-title" ref={headingRef} tabIndex={-1}>
            Find a better fit.
          </h1>
          <p className={styles.onboardingCopy}>
            Point your camera at a shelf.
            <br />
            Compare similar products
            <br />
            by sugar and protein.
          </p>
        </div>

        <figure className={styles.onboardingPreview} data-testid="onboarding-preview">
          <div className={styles.onboardingPreviewImage}>
            <Image
              src="/samples/latvia-shelf.jpg"
              alt="Protein bars on a shop shelf. Four products are outlined and one is labelled Great fit."
              fill
              priority
              sizes="(max-width: 460px) calc(100vw - 40px), 420px"
            />
            {[1, 26, 51, 76].map((left, index) => (
              <span key={left} className={styles.onboardingSampleBox} style={{ left: `${left}%` }} aria-hidden="true">
                {index === 0 ? <span className={styles.onboardingFit}>Great fit</span> : null}
              </span>
            ))}
          </div>
          <figcaption className={styles.onboardingResult}>
            <span className={styles.onboardingResultCopy}>
              <strong>4 products compared</strong>
              <small>Best fit appears first</small>
            </span>
            <span className={styles.onboardingFit}>Great fit</span>
          </figcaption>
        </figure>

        <div className={styles.onboardingActions}>
          <button className={styles.onboardingPrimary} type="button" onClick={onComplete}>
            Open camera
          </button>
          <button className={styles.secondaryButton} type="button" onClick={onTrySample}>
            Try a sample shelf
          </button>
          <p className={styles.onboardingNote}>Camera opens only after you choose Open camera. Photos are not saved.</p>
        </div>
      </div>
    </section>
  );
}
