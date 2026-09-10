// Header-only navigation boundary: never render third-party scripts beside payment URLs.
export function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  const valid = sessionId && /^cs_(?:test|live)_[A-Za-z0-9]{1,160}$/.test(sessionId);
  // Relative target keeps redirects on this origin regardless of forwarded headers or input.
  const location = valid ? `/?checkout=success&session_id=${encodeURIComponent(sessionId)}` : "/";
  return new Response(null, { status: 303, headers: {
    Location: location,
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex"
  } });
}
