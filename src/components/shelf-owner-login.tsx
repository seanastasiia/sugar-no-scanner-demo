"use client";
import { useEffect, useState } from "react";
import styles from "./shelf-queue.module.css";
export function ShelfOwnerLogin() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!value) return;
    history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => setToken(value));
  }, []);
  async function submit(email?: string) {
    setBusy(true);
    try {
      const response = await fetch(`/pilot/shelf/owner/${token ? "session" : "request"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(token ? { token } : { email }) });
      if (!response.ok) { setMessage(token ? "This link has expired or is invalid. Request a new email below." : "Could not send the email. Please try again later."); setToken(""); return; }
      if (token) { window.location.replace("/pilot/shelf"); return; }
      setMessage("If this is the owner email, a sign-in link is on its way. Open it on this device within 15 minutes.");
    } catch { setMessage("Could not connect. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <nav><a href="/pilot/shelf">Back to Personal Shelf</a></nav>
    <h1>Personal Shelf owner access</h1>
    <p>Free scans for the owner, only in Personal Shelf.</p>
    <section className={styles.card}>
      {token ? <button disabled={busy} onClick={() => void submit()}>Enable my free access</button> : <form className={styles.form} onSubmit={event => { event.preventDefault(); void submit(String(new FormData(event.currentTarget).get("email") || "")); }}>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <button type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
      </form>}
      {message ? <p role="status">{message}</p> : null}
    </section>
  </main>;
}
