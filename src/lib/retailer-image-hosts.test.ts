import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import livinProducts from "../../data/livin-catalog.generated.json";
import rimiProducts from "../../data/rimi-catalog.generated.json";

function configuredImageHosts() {
  return new Set(
    (nextConfig.images?.remotePatterns || [])
      .map((pattern) => pattern instanceof URL ? pattern.hostname : pattern.hostname)
      .filter(Boolean)
  );
}

describe("retailer product images", () => {
  it("allows every image host used by the Rimi and Livin snapshots", () => {
    const catalogHosts = new Set(
      [...rimiProducts, ...livinProducts]
        .map((product) => product.imageUrl ? new URL(product.imageUrl).hostname : null)
        .filter((hostname): hostname is string => Boolean(hostname))
    );

    expect(catalogHosts.size).toBeGreaterThan(0);
    expect([...catalogHosts].filter((hostname) => !configuredImageHosts().has(hostname))).toEqual([]);
  });
});
