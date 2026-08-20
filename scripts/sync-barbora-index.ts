import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sitemapUrl = "https://barbora.lv/sitemap.xml";
const outputPath = path.resolve("data/barbora-product-index.generated.json");

async function main() {
  const response = await fetch(sitemapUrl, {
    headers: { "user-agent": "Sugar.no Latvia catalog research demo/0.1" },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`${sitemapUrl} returned ${response.status}`);
  const sitemap = await response.text();
  const slugs = [
    ...new Set(
      [...sitemap.matchAll(/<loc>https:\/\/barbora\.lv\/produkti\/([^<]+)<\/loc>/g)].map((match) =>
        decodeURIComponent(match[1]).trim()
      )
    )
  ].filter(Boolean).sort();

  if (slugs.length < 10_000) {
    throw new Error(`Expected a broad Barbora product index, received only ${slugs.length} products`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(slugs)}\n`, "utf8");
  console.log(`Wrote ${slugs.length} Barbora product slugs to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
