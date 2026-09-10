"use client";

import { syncMetaWithdrawal } from "@/lib/meta-consent-sync";
import { useEffect, useState } from "react";
import { configureMeta, readMetaConsent, setMetaConsent, startMeta } from "@/lib/meta-pixel";
import styles from "./meta-consent.module.css";

export function MetaConsent({ pixelId }: { pixelId: string }) {
  const [consent, setConsent] = useState<"granted" | "denied" | null>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    configureMeta(pixelId);
    const timer = window.setTimeout(() => {
      const saved = readMetaConsent();
      void syncMetaWithdrawal(saved === "denied");
      setConsent(saved);
      setOpen(saved === null || new URLSearchParams(window.location.search).get("privacy") === "1");
      startMeta();
    }, 0);
    const retry = window.setInterval(startMeta, 1000);
    const sync = (event: StorageEvent) => {
      if (event.key === "sugar-scanner-meta-consent-v1" || event.key === null) {
        const saved = readMetaConsent();
        setConsent(saved);
        setOpen(saved === null);
        setMetaConsent(saved || "denied");
        void syncMetaWithdrawal(saved !== "granted");
        startMeta();
      }
    };
    window.addEventListener("storage", sync);
    return () => { clearTimeout(timer); clearInterval(retry); window.removeEventListener("storage", sync); };
  }, [pixelId]);
  const choose = (value: "granted" | "denied") => {
    setConsent(value);
    setMetaConsent(value);
    if (value === "denied") void syncMetaWithdrawal(true);
    startMeta();
    setOpen(false);
  };
  if (consent === undefined || (consent === "granted" && !open)) return null;
  return <aside data-meta-consent className={styles.container} aria-label="Advertising privacy">
    {open ? <section className={styles.card} aria-labelledby="meta-consent-title">
      <h2 id="meta-consent-title">Help us measure our ads?</h2>
      <p>With your permission, Meta uses cookies and receives payment confirmations from our server to measure visits and purchases. We do not send your photos, scanned products, nutrition or email. Scanner works either way.</p>
      <div className={styles.actions}>
        <button onClick={() => choose("denied")}>No thanks</button>
        <button onClick={() => choose("granted")}>Allow Meta cookies</button>
      </div>
      <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer">Meta privacy policy</a>
    </section> : <button className={styles.settings} onClick={() => setOpen(true)}>Ad privacy</button>}
  </aside>;
}
