import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/storage";
import type { InventoryEntry } from "@/lib/inventory";

const LOG_DOC = "inventory-log.json";

// POST /api/inventory/reconcile { ids: string[] }
// Stamps reconciledAt on the given entries — "these are now in EKOS".
// Pass { ids: [...], undo: true } to clear the stamp instead.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }
  const ids = new Set(body.ids.filter((x: unknown) => typeof x === "string"));
  const undo = body.undo === true;

  const log = await readData<InventoryEntry[]>(LOG_DOC);
  const now = new Date().toISOString();
  let count = 0;
  const next = log.map((e) => {
    if (!ids.has(e.id)) return e;
    count++;
    if (undo) {
      const { reconciledAt: _drop, ...rest } = e;
      void _drop;
      return rest as InventoryEntry;
    }
    return { ...e, reconciledAt: now };
  });

  if (count === 0) {
    return NextResponse.json({ error: "No matching entries" }, { status: 404 });
  }
  await writeData(LOG_DOC, next);
  return NextResponse.json({ success: true, count });
}
