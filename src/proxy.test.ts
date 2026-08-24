import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

describe("public scanner proxy", () => {
  it.each(["/", "/api/recognize", "/api/products/example"])(
    "does not redirect or require a session for %s",
    (pathname) => {
      const response = proxy(new NextRequest(`https://scanner.example${pathname}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  );
});
