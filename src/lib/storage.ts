import fs from "fs/promises";
import path from "path";
import { put, list } from "@vercel/blob";

// Persistent storage for the small mutable JSON documents the admin panel
// edits (event config, custom holidays).
//
// On Vercel the local filesystem is read-only/ephemeral, so writes are lost on
// every deploy. When a Blob token is present we read/write Vercel Blob instead;
// otherwise (local dev) we use the files under src/data so the dev loop is
// unchanged. On first read in production we seed Blob from the file committed
// to the repo.

const DATA_DIR = path.join(process.cwd(), "src/data");

// Vercel injects BLOB_READ_WRITE_TOKEN when a Blob store is connected.
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

async function readSeedFile(name: string) {
  const raw = await fs.readFile(path.join(DATA_DIR, name), "utf-8");
  return JSON.parse(raw);
}

async function readFromBlob(name: string) {
  const { blobs } = await list({ prefix: name, limit: 1 });
  const match = blobs.find((b) => b.pathname === name);
  if (!match) return null;
  // no-store so we never serve a stale config from Next's fetch cache.
  const res = await fetch(match.url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function writeData(name: string, data: unknown): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  if (useBlob) {
    await put(name, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return;
  }
  await fs.writeFile(path.join(DATA_DIR, name), body);
}

export async function readData<T = unknown>(name: string): Promise<T> {
  if (useBlob) {
    const fromBlob = await readFromBlob(name);
    if (fromBlob !== null) return fromBlob as T;
    // First run with an empty store: seed it from the bundled file.
    const seed = await readSeedFile(name);
    await writeData(name, seed);
    return seed as T;
  }
  return (await readSeedFile(name)) as T;
}
