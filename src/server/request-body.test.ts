import { describe, expect, it } from "vitest";
import { RequestBodyError, readBoundedJson } from "./request-body";

describe("readBoundedJson", () => {
  it("parses a body inside the byte budget", async () => {
    const request = new Request("https://example.test", { method: "POST", body: JSON.stringify({ ok: true }) });
    await expect(readBoundedJson(request, 64)).resolves.toEqual({ ok: true });
  });

  it("rejects actual oversized bodies even without a content-length header", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ value: "x".repeat(80) })));
        controller.close();
      }
    });
    const request = new Request("https://example.test", {
      method: "POST",
      body: stream,
      // Node's fetch runtime requires duplex for a streamed request body.
      duplex: "half"
    } as RequestInit);
    await expect(readBoundedJson(request, 32)).rejects.toEqual(new RequestBodyError("body_too_large"));
  });
});
