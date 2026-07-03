import fs from "fs/promises";
import path from "path";
import { put, get } from "@vercel/blob";

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

// Read through the Blob API (SDK get), NOT the public CDN URL. The CDN can
// serve a previous version of an overwritten blob for a minute or more, which
// made read-modify-write cycles lose entries: a write would read the stale
// doc, append one item, and overwrite everything newer. get() is
// read-after-write consistent.
//
// Returns null ONLY when the blob doesn't exist (first run -> caller seeds).
// Any other failure throws: falling back to the seed on a transient error
// would let the next write wipe real data.
async function readFromBlob(name: string) {
  const result = await get(name, { access: "public" });
  if (result === null) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`Unexpected blob read status ${result.statusCode} for ${name}`);
  }
  const text = await new Response(result.stream).text();
  return JSON.parse(text);
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
