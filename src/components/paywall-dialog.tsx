"use client";

import Image from "next/image";
import { CalendarCheck, Camera, Check, ImagePlus, ScanLine, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { paidAccessAllowanceLabel } from "@/lib/wtp-access";
import styles from "./paywall-dialog.module.css";

type PaywallVariant = "initial" | "renewal";

export function PaywallDialog({
  variant = "initial",
  onClose,
  onCheckout,
  onRestore
}: {
  variant?: PaywallVariant;
  onClose: () => void;
  onCheckout: () => Promise<void>;
  onRestore: (email: string) => Promise<void>;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [checkoutState, setCheckoutState] = useState<"idle" | "loading" | "error">("idle");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [restoreState, setRestoreState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const renewing = variant === "renewal";

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && checkoutState !== "loading") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checkoutState, onClose]);

  async function checkout() {
    setCheckoutState("loading");
    try {
      await onCheckout();
    } catch {
      setCheckoutState("error");
    }
  }

  async function restore(event: FormEvent) {
    event.preventDefault();
    setRestoreState("loading");
    try {
      await onRestore(email);
      setRestoreState("sent");
    } catch {
      setRestoreState("error");
    }
  }

  return (
    <div className={styles.scrim} role="presentation">
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="paywall-title">
        <div className={styles.grabber} aria-hidden="true" />
        <button className={styles.close} type="button" onClick={onClose} aria-label="Close offer" disabled={checkoutState === "loading"}>
          <X aria-hidden="true" size={21} />
        </button>

        <div className={styles.hero} aria-hidden="true">
          <Image src="/onboarding/shelf-scan.jpg" alt="" fill sizes="390px" priority />
          <div className={styles.heroWash} />
          <div className={styles.scanFrame}><ScanLine size={42} strokeWidth={1.8} /></div>
          <span className={`${styles.ratingDot} ${styles.ratingDotOne}`}><Check size={15} /></span>
          <span className={`${styles.ratingDot} ${styles.ratingDotTwo}`}><Check size={15} /></span>
        </div>

        <div className={styles.content}>
          <p className={styles.eyebrow}>{renewing ? "Ready for another shop?" : "Sugar.no scanner pass"}</p>
          <h2 ref={titleRef} id="paywall-title" tabIndex={-1}>
            {renewing ? "Your 7 days have ended" : "Keep scanning shelves"}
          </h2>
          <p className={styles.intro}>
            {renewing ? "Unlock another 7 days of unlimited scanning." : "You’ve used your 3 free scans."}
          </p>

          <ul className={styles.benefits}>
            <li><span><CalendarCheck aria-hidden="true" size={18} /></span>Unlimited scans for 7 days</li>
            <li><span><Camera aria-hidden="true" size={18} /></span>Live camera and photo upload</li>
            <li><span><ImagePlus aria-hidden="true" size={18} /></span>Sugar.no comparisons from confirmed data</li>
          </ul>

          <div className={styles.offer}>
            <div><strong>7 days</strong><span>of unlimited scans</span></div>
            <div className={styles.price}><strong>€2.99</strong><span>one payment</span></div>
          </div>

          {checkoutState === "error" ? <p className={styles.error} role="alert">Payment could not open. Please try again.</p> : null}
          <button className={styles.primary} type="button" onClick={checkout} disabled={checkoutState === "loading"}>
            {checkoutState === "loading"
              ? "Opening secure checkout…"
              : renewing ? "Unlock 7 more days for €2.99" : "Unlock 7 days for €2.99"}
          </button>
          <p className={styles.reassurance}>Access ends after 7 days. Nothing renews.</p>
          <button className={styles.secondary} type="button" onClick={onClose} disabled={checkoutState === "loading"}>Not now</button>

          {!restoreOpen ? (
            <button className={styles.restoreLink} type="button" onClick={() => setRestoreOpen(true)}>Restore purchase</button>
          ) : (
            <form className={styles.restoreForm} onSubmit={restore}>
              <label htmlFor="restore-email">Email used at checkout</label>
              <input id="restore-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              {restoreState === "sent" ? (
                <p className={styles.success} role="status">If an active purchase exists, we sent a restoration link.</p>
              ) : (
                <button type="submit" disabled={restoreState === "loading"}>{restoreState === "loading" ? "Sending…" : "Email me a link"}</button>
              )}
              {restoreState === "error" ? <p className={styles.error} role="alert">We could not send the link. Please try again.</p> : null}
            </form>
          )}
          <p className={styles.secure}>Secure payment by Stripe · No subscription</p>
        </div>
      </section>
    </div>
  );
}

export function PaymentSuccessDialog({
  expiresAt,
  onContinue
}: {
  expiresAt: string | null;
  onContinue: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const daysLabel = expiresAt ? paidAccessAllowanceLabel(expiresAt) : "7 days left";

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className={styles.scrim} role="presentation">
      <section className={`${styles.dialog} ${styles.successDialog}`} role="dialog" aria-modal="true" aria-labelledby="payment-success-title">
        <div className={styles.grabber} aria-hidden="true" />
        <div className={`${styles.hero} ${styles.successHero}`} aria-hidden="true">
          <div className={styles.successMark}><Check size={46} strokeWidth={2.5} /></div>
        </div>
        <div className={styles.content}>
          <p className={styles.eyebrow}>Payment successful</p>
          <h2 ref={titleRef} id="payment-success-title" tabIndex={-1} aria-live="polite">You’re all set</h2>
          <p className={styles.intro}>Unlimited scanning is active. {daysLabel}.</p>
          <button className={styles.primary} type="button" onClick={onContinue}>Start scanning</button>
          <p className={styles.reassurance}>Access ends automatically. Nothing renews.</p>
        </div>
      </section>
    </div>
  );
}
