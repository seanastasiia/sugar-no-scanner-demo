// Railway mounts this directory: preserve the mount and remove only generated contents.
import { readdir, rm } from "node:fs/promises";
const directory = new URL("../.next/cache/", import.meta.url);
const entries = await readdir(directory).catch(error => {
  if (error.code === "ENOENT") return [];
  throw error;
});
for (const entry of entries) await rm(new URL(entry, directory), { recursive: true, force: true });
