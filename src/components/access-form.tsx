"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export function AccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Access could not be verified.");
      const nextPath = searchParams.get("next");
      router.replace(nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="access-form" onSubmit={submit}>
      <label htmlFor="access-code">Investor access code</label>
      <div className="access-field">
        <LockKeyhole aria-hidden="true" size={20} />
        <input
          id="access-code"
          name="code"
          type="password"
          autoComplete="current-password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          minLength={1}
        />
      </div>
      {error ? (
        <p className="access-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button button-primary" type="submit" disabled={submitting}>
        {submitting ? "Checking…" : "Open demo"}
        <ArrowRight aria-hidden="true" size={18} />
      </button>
    </form>
  );
}
