import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const standaloneRoot = path.resolve(".next/standalone");
const publicTarget = path.join(standaloneRoot, "public");
const staticTarget = path.join(standaloneRoot, ".next/static");

await rm(publicTarget, { recursive: true, force: true });
await rm(staticTarget, { recursive: true, force: true });
await mkdir(path.dirname(staticTarget), { recursive: true });
await cp(path.resolve("public"), publicTarget, { recursive: true });
await cp(path.resolve(".next/static"), staticTarget, { recursive: true });
console.log("Prepared standalone public and static assets.");
