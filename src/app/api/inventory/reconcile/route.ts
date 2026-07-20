import { NextResponse } from "next/server";
import { readData, mutateData } from "@/lib/storage";
import type {
  InventoryEntry,
  CatalogBeer,
  ReconcileRecord,
} from "@/lib/inventory";
import { makeEkosNameResolver } from "@/lib/inventory-report";

const LOG_DOC = "inventory-log.json";
const CATALOG_DOC = "inventory-catalog.json";
const ARCHIVE_DOC = "ekos-reconcile-archive.json";

// How long to keep the EKOS check-off audit trail.
const RETAIN_MS = 365 * 24 * 60 * 60 * 1000;

// POST /api/inventory/reconcile { ids: string[] }
// Stamps reconciledAt on the given entries — "these are now in EKOS" — and
// records each one in a year-long archive so the check-off history survives
// even after the live log drops its oldest entries.
// Pass { ids: [...], undo: true } to clear the stamp and remove the records.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }
  const ids = new Set(body.ids.filter((x: unknown) => typeof x === "string"));
  const undo = body.undo === true;

  const now = new Date().toISOString();
  let count = 0;
  let stamped: InventoryEntry[] = [];
  await mutateData<InventoryEntry[]>(LOG_DOC, (log) => {
    count = 0;
    stamped = [];
    return log.map((e) => {
      if (!ids.has(e.id)) return e;
      count++;
      if (undo) {
        const { reconciledAt: _drop, ...rest } = e;
        void _drop;
        return rest as InventoryEntry;
      }
      const updated = { ...e, reconciledAt: now };
      stamped.push(updated);
      return updated;
    });
  });

  if (count === 0) {
    return NextResponse.json({ error: "No matching entries" }, { status: 404 });
  }

  const cutoff = Date.now() - RETAIN_MS;
  const prune = (records: ReconcileRecord[]) =>
    records.filter((r) => new Date(r.enteredAt).getTime() >= cutoff);

  if (undo) {
    // Roll the archive back for the un-checked entries (and prune while here).
    await mutateData<ReconcileRecord[]>(ARCHIVE_DOC, (arc) =>
      prune(arc.filter((r) => !ids.has(r.id)))
    );
  } else if (stamped.length > 0) {
    // Snapshot the resolved EKOS name at check-off time so the record shows
    // exactly what was entered, even if the catalog mapping changes later.
    const catalog = await readData<CatalogBeer[]>(CATALOG_DOC);
    const ekosNameOf = makeEkosNameResolver(catalog);
    const records: ReconcileRecord[] = stamped.map((e) => ({
      id: e.id,
      type: e.type,
      beerName: e.beerName,
      ekosName: ekosNameOf(e),
      ...(e.type === "case-added"
        ? { packSize: e.packSize, quantity: e.quantity }
        : { size: e.size }),
      ...(e.note ? { note: e.note } : {}),
      loggedAt: e.timestamp,
      enteredAt: now,
    }));
    await mutateData<ReconcileRecord[]>(ARCHIVE_DOC, (arc) => {
      // Upsert by id (re-checking an entry refreshes its record), then prune.
      const byId = new Map(arc.map((r) => [r.id, r]));
      for (const r of records) byId.set(r.id, r);
      return prune(Array.from(byId.values()));
    });
  }

  return NextResponse.json({ success: true, count });
}
