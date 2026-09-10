"use client";

import { useEffect, useState } from "react";
import { configureMeta, readMetaConsent, setMetaConsent, startMeta } from "@/lib/meta-pixel";
import styles from "./meta-consent.module.css";

export function MetaConsent({ pixelId }: { pixelId: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    configureMeta(pixelId);
    const timer = window.setTimeout(() => { setOpen(readMetaConsent() === null); startMeta(); }, 0);
    const retry = window.setInterval(startMeta, 1000);
    const sync = (event: StorageEvent) => {
      if (event.key === "sugar-scanner-meta-consent-v1" || event.key === null) {
        setMetaConsent(readMetaConsent() || "denied");
        startMeta();
      }
    };
    window.addEventListener("storage", sync);
    return () => { clearTimeout(timer); clearInterval(retry); window.removeEventListener("storage", sync); };
  }, [pixelId]);
  const choose = (value: "granted" | "denied") => {
    setMetaConsent(value);
    startMeta();
    setOpen(false);
  };
  return <aside data-meta-consent className={styles.container} aria-label="Advertising privacy">
    {open ? <section className={styles.card} aria-labelledby="meta-consent-title">
      <h2 id="meta-consent-title">Help us measure our ads?</h2>
      <p>With your permission, Meta uses cookies to measure visits and payment steps. We do not send your photos, scanned products, nutrition or email. Scanner works either way.</p>
      <div className={styles.actions}>
        <button onClick={() => choose("denied")}>No thanks</button>
        <button onClick={() => choose("granted")}>Allow Meta cookies</button>
      </div>
      <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer">Meta privacy policy</a>
    </section> : <button className={styles.settings} onClick={() => setOpen(true)}>Ad privacy</button>}
  </aside>;
}
