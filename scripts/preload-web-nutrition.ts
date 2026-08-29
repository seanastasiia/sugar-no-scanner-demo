import { readFile } from "node:fs/promises";
import { resolveWebNutritionProduct } from "../src/server/web-nutrition";

interface IdentityInput {
  brand: string;
  name: string;
  variant?: string | null;
  packSize?: string | null;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        await task(item);
      }
    })
  );
}

const inputPath = argument("--input") || "data/preload-identities.latvia-demo.json";
const apply = process.argv.includes("--apply");
const limit = Math.max(1, Math.min(2_000, Number.parseInt(argument("--limit") || "200", 10) || 200));
const parsed = JSON.parse(await readFile(inputPath, "utf8")) as IdentityInput[];
const identities = parsed
  .filter((item) => item.brand?.trim() && item.name?.trim())
  .slice(0, limit);

if (!apply) {
  console.log(JSON.stringify({ mode: "dry_run", inputPath, candidates: identities.length, next: "rerun with --apply" }, null, 2));
  process.exit(0);
}

if (!process.env.GEMINI_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("GEMINI_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply");
}

let resolved = 0;
let misses = 0;
await mapWithConcurrency(identities, 3, async (identity) => {
  const result = await resolveWebNutritionProduct(
    {
      brand: identity.brand.trim(),
      name: identity.name.trim(),
      variant: identity.variant?.trim() || "",
      packSize: identity.packSize?.trim() || "",
      searchTerms: []
    },
    1
  );
  if (result) resolved += 1;
  else misses += 1;
});

console.log(JSON.stringify({ mode: "apply", inputPath, candidates: identities.length, resolved, misses }, null, 2));
