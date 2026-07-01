import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/storage";
import type { InventoryEntry, KegSize, PackSize } from "@/lib/inventory";

const LOG_DOC = "inventory-log.json";
const MAX_ENTRIES = 500; // hard cap to keep the doc small

const VALID_SIZES: KegSize[] = ["1/2", "1/6"];
const VALID_PACKS: PackSize[] = ["4-pack", "6-pack", "12-pack"];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// GET /api/inventory?limit=50 — most recent entries first.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = parseInt(searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(raw, 200)) : 50;

  const log = await readData<InventoryEntry[]>(LOG_DOC);
  const sorted = [...log].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return NextResponse.json({ entries: sorted.slice(0, limit) });
}

// POST /api/inventory — append a new entry. Open to the tablet (no auth).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid body");

  const { type, beerName, size, packSize, quantity, note } = body as Record<
    string,
    unknown
  >;
  const trimmedName = typeof beerName === "string" ? beerName.trim() : "";
  if (!trimmedName) return badRequest("beerName is required");

  const now = new Date().toISOString();
  const id = `inv-${Date.now()}-${Math.floor(Math.random() * 1e6)
    .toString(36)
    .padStart(4, "0")}`;

  let entry: InventoryEntry;
  if (type === "keg-tapped" || type === "keg-blew") {
    if (typeof size !== "string" || !VALID_SIZES.includes(size as KegSize)) {
      return badRequest("size must be '1/2' or '1/6'");
    }
    entry = {
      id,
      type,
      timestamp: now,
      beerName: trimmedName,
      size: size as KegSize,
      ...(typeof note === "string" && note.trim() ? { note: note.trim() } : {}),
    };
  } else if (type === "case-added") {
    const qtyNum = typeof quantity === "number" ? quantity : parseInt(String(quantity ?? "1"), 10);
    if (!Number.isFinite(qtyNum) || qtyNum < 1 || qtyNum > 999) {
      return badRequest("quantity must be between 1 and 999");
    }
    if (typeof packSize !== "string" || !VALID_PACKS.includes(packSize as PackSize)) {
      return badRequest("packSize must be 4-pack, 6-pack, or 12-pack");
    }
    entry = {
      id,
      type,
      timestamp: now,
      beerName: trimmedName,
      quantity: qtyNum,
      packSize: packSize as PackSize,
      ...(typeof note === "string" && note.trim() ? { note: note.trim() } : {}),
    };
  } else {
    return badRequest("type must be keg-tapped, keg-blew, or case-added");
  }

  const log = await readData<InventoryEntry[]>(LOG_DOC);
  log.push(entry);

  // Keep the doc bounded: drop the oldest when we exceed the cap.
  const trimmed =
    log.length > MAX_ENTRIES
      ? [...log]
          .sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, MAX_ENTRIES)
      : log;

  await writeData(LOG_DOC, trimmed);
  return NextResponse.json({ success: true, entry });
}

// DELETE /api/inventory?id=... — remove one entry (undo). Open, same as POST.
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("id is required");

  const log = await readData<InventoryEntry[]>(LOG_DOC);
  const next = log.filter((e) => e.id !== id);
  if (next.length === log.length) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  await writeData(LOG_DOC, next);
  return NextResponse.json({ success: true });
}
