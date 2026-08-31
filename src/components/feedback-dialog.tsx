"use client";

import { Check, MessageSquareText, RefreshCw, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { ScanSource } from "@/lib/types";
import styles from "./scanner-app.module.css";

const reasons = [
  ["wrong_product", "Wrong product"],
  ["no_result", "No useful result"],
  ["too_slow", "Too slow"],
  ["unclear", "Result was unclear"],
  ["other", "Something else"]
] as const;

type State = "idle" | "loading" | "success" | "error";

export function FeedbackDialog({
  open,
  sessionId,
  source,
  onClose,
  onSubmitted
}: {
  open: boolean;
  sessionId: string;
  source: ScanSource;
  onClose: () => void;
  onSubmitted: (helpful: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<State>("idle");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && stateRef.current !== "loading") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  function closeDialog() {
    setHelpful(null);
    setReason("");
    setComment("");
    setState("idle");
    onClose();
  }

  const context = source === "camera" ? "camera" : source === "upload" ? "results" : "demo";
  const canSubmit = helpful !== null && (helpful || Boolean(reason));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || state === "loading") return;
    setState("loading");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, helpful, reason: helpful ? null : reason, comment, context })
      });
      if (!response.ok) throw new Error("Feedback request failed");
      setState("success");
      onSubmitted(Boolean(helpful));
    } catch {
      setState("error");
    }
  }

  return (
    <div className={styles.feedbackBackdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && state !== "loading") closeDialog();
    }}>
      <div ref={dialogRef} className={styles.feedbackDialog} role="dialog" aria-modal="true" aria-labelledby="feedback-title" tabIndex={-1}>
        <button className={styles.dialogClose} type="button" onClick={closeDialog} aria-label="Close feedback" disabled={state === "loading"}>
          <X aria-hidden="true" size={20} />
        </button>
        {state === "success" ? (
          <div className={styles.feedbackSuccess}>
            <span><Check aria-hidden="true" size={28} /></span>
            <h2 id="feedback-title">Thank you</h2>
            <p>Your feedback was saved and will help us improve the pilot.</p>
            <button className={styles.primaryButton} type="button" onClick={closeDialog}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <MessageSquareText className={styles.feedbackHeadingIcon} aria-hidden="true" size={25} />
            <h2 id="feedback-title">Was this scan helpful?</h2>
            <p className={styles.feedbackIntro}>A quick answer helps us improve recognition.</p>
            <div className={styles.feedbackChoices} role="group" aria-label="Feedback rating">
              <button className={helpful === true ? styles.feedbackChoiceActive : undefined} type="button" onClick={() => { setHelpful(true); setReason(""); }}>
                <ThumbsUp aria-hidden="true" size={19} /> Helpful
              </button>
              <button className={helpful === false ? styles.feedbackChoiceActive : undefined} type="button" onClick={() => setHelpful(false)}>
                <ThumbsDown aria-hidden="true" size={19} /> Needs work
              </button>
            </div>
            {helpful === false ? (
              <fieldset className={styles.feedbackReasons}>
                <legend>What went wrong?</legend>
                {reasons.map(([value, label]) => (
                  <label key={value}><input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} /> {label}</label>
                ))}
              </fieldset>
            ) : null}
            {helpful !== null ? (
              <label className={styles.feedbackComment}>
                Anything else? <span>Optional</span>
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={300} rows={3} placeholder="Tell us what you noticed" />
                <small>Do not include personal information. {comment.length}/300</small>
              </label>
            ) : null}
            {state === "error" ? <p className={styles.feedbackError} role="alert">Couldn’t save feedback. Please retry.</p> : null}
            <button className={styles.primaryButton} type="submit" disabled={!canSubmit || state === "loading"}>
              {state === "loading" ? <><RefreshCw className={styles.spin} aria-hidden="true" size={18} /> Saving…</> : state === "error" ? <><RefreshCw aria-hidden="true" size={18} /> Retry</> : "Send feedback"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
