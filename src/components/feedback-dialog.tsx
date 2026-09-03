"use client";

import { Check, RefreshCw, ThumbsDown, ThumbsUp, X } from "lucide-react";
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
  const backdropRef = useRef<HTMLDivElement>(null);
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
    const viewport = window.visualViewport;
    const resize = () => {
      backdropRef.current?.style.setProperty("--feedback-viewport", `${viewport?.height || window.innerHeight}px`);
      backdropRef.current?.style.setProperty("--feedback-offset", `${viewport?.offsetTop || 0}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && stateRef.current !== "loading") onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const items = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]"
          )
        );
        const first = items[0];
        const last = items.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
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
    <div
      ref={backdropRef}
      className={styles.feedbackBackdrop}
      data-expanded={helpful !== null && state !== "success"}
      data-feedback-state={state}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && state !== "loading") closeDialog();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.feedbackDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        tabIndex={-1}
      >
        <div className={styles.feedbackHeader}>
          {state !== "success" ? <h2 id="feedback-title">Was this scan<br />helpful?</h2> : null}
          <button
            className={styles.dialogClose}
            type="button"
            onClick={closeDialog}
            aria-label="Close feedback"
            disabled={state === "loading"}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        {state === "success" ? (
          <>
            <div className={styles.feedbackSuccess}>
              <span>
                <Check aria-hidden="true" size={30} />
              </span>
              <h2 id="feedback-title">Thank you</h2>
              <p>Your feedback was saved and will help us improve the pilot.</p>
            </div>
            <div className={styles.feedbackFooter}>
              <button className={styles.primaryButton} type="button" onClick={closeDialog}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className={styles.feedbackBody}>
              <p className={styles.feedbackIntro}>A quick answer helps us improve recognition.</p>
              <div className={styles.feedbackChoices} role="group" aria-label="Feedback rating">
                <button
                  className={helpful === true ? styles.feedbackChoiceActive : undefined}
                  type="button"
                  aria-pressed={helpful === true}
                  disabled={state === "loading"}
                  onClick={() => {
                    setHelpful(true);
                    setReason("");
                  }}
                >
                  <ThumbsUp aria-hidden="true" size={19} /> Helpful
                </button>
                <button
                  className={helpful === false ? styles.feedbackChoiceActive : undefined}
                  type="button"
                  aria-pressed={helpful === false}
                  disabled={state === "loading"}
                  onClick={() => setHelpful(false)}
                >
                  <ThumbsDown aria-hidden="true" size={19} /> Needs work
                </button>
              </div>
              {helpful === false ? (
                <fieldset className={styles.feedbackReasons} disabled={state === "loading"}>
                  <legend>What went wrong?</legend>
                  {reasons.map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="reason"
                        value={value}
                        checked={reason === value}
                        onChange={() => setReason(value)}
                      />{" "}
                      {label}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {helpful !== null ? (
                <label className={styles.feedbackComment}>
                  <span>Anything else? <span>Optional</span></span>
                  <textarea
                    disabled={state === "loading"}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    maxLength={300}
                    rows={2}
                    placeholder="Tell us what you noticed"
                  />
                  <small>Do not include personal information. {comment.length}/300</small>
                </label>
              ) : null}
              {state === "error" ? (
                <p className={styles.feedbackError} role="alert">
                  Couldn’t save feedback. Please retry.
                </p>
              ) : null}
            </div>
            <div className={styles.feedbackFooter}>
              <button className={helpful === null ? styles.secondaryButton : styles.primaryButton} type="submit" disabled={!canSubmit || state === "loading"}>
                {state === "loading" ? (
                  <>
                    <RefreshCw className={styles.spin} aria-hidden="true" size={18} /> Saving…
                  </>
                ) : state === "error" ? (
                  <>
                    <RefreshCw aria-hidden="true" size={18} /> Retry
                  </>
                ) : (
                  "Send feedback"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
