"use client";

import Image from "next/image";
import { Check, LockKeyhole, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./paywall-dialog.module.css";

export function PaywallDialog({
  onClose,
  onCheckout,
  onRestore
}: {
  onClose: () => void;
  onCheckout: () => Promise<void>;
  onRestore: (email: string) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [checkoutState, setCheckoutState] = useState<"idle" | "loading" | "error">("idle");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [restoreState, setRestoreState] = useState<"idle" | "loading" | "sent" | "error">("idle");

  useEffect(() => {
    dialogRef.current?.focus();
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
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="paywall-title" tabIndex={-1}>
        <div className={styles.brandRow}>
          <Image src="/brand/sugar-no-logo-white.svg" alt="Sugar.no" width={128} height={25} unoptimized />
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close offer" disabled={checkoutState === "loading"}>
            <X aria-hidden="true" size={22} />
          </button>
        </div>

        <div className={styles.icon} aria-hidden="true"><LockKeyhole size={28} /></div>
        <p className={styles.eyebrow}>Your 3 free scans are complete</p>
        <h2 id="paywall-title">Keep comparing products</h2>
        <p className={styles.intro}>Get 7 days of scanner access for one small payment.</p>

        <ul className={styles.benefits}>
          <li><Check aria-hidden="true" size={18} /> Unlimited scans for 7 days</li>
          <li><Check aria-hidden="true" size={18} /> Sugar.no comparisons from confirmed data</li>
          <li><Check aria-hidden="true" size={18} /> Access ends automatically</li>
        </ul>

        <div className={styles.price}><strong>€2.99</strong><span>one-time payment</span></div>
        {checkoutState === "error" ? <p className={styles.error} role="alert">Payment could not open. Please try again.</p> : null}
        <button className={styles.primary} type="button" onClick={checkout} disabled={checkoutState === "loading"}>
          {checkoutState === "loading" ? "Opening secure checkout…" : "Continue for €2.99"}
        </button>
        <button className={styles.secondary} type="button" onClick={onClose} disabled={checkoutState === "loading"}>Not now</button>

        {!restoreOpen ? (
          <button className={styles.restoreLink} type="button" onClick={() => setRestoreOpen(true)}>Already paid? Restore access</button>
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
        <p className={styles.secure}>Secure payment by Stripe. No subscription or automatic renewal.</p>
      </div>
    </div>
  );
}
