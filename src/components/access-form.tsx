"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

function safeDestination(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function AccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedCode = String(new FormData(event.currentTarget).get("code") ?? "");
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: submittedCode })
      });
      if (!response.ok) {
        setError("That code did not work. Try again.");
        return;
      }
      router.replace(safeDestination(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("Could not connect. Check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="access-form" onSubmit={submit}>
      <label htmlFor="demo-code">Demo access code</label>
      <input
        id="demo-code"
        name="code"
        type="password"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
      />
      {error ? <p className="access-error" role="alert">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Opening…" : "Open scanner"}
      </button>
    </form>
  );
}
