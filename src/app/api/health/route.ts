import { NextResponse } from "next/server";
import { readData } from "@/lib/storage";
import type { CatalogBeer, InventoryEntry } from "@/lib/inventory";
import { normalizeBeerName } from "@/lib/inventory";
import { duplicateCatalogNames, repairCatalog } from "@/lib/catalog-repair";

// How long an inventory movement may sit un-entered into EKOS before health
// flags the sync as stalled. The hand-off runs daily, so 3 days of backlog
// means several runs have been missed.
const STALE_PENDING_DAYS = 3;

export async function GET() {
  const services = {
    googleCalendar: !!process.env.GOOGLE_CALENDAR_ID && !!process.env.GOOGLE_PRIVATE_KEY,
    untappd: !!process.env.UNTAPPD_API_KEY,
    predictHQ: !!process.env.PREDICTHQ_API_KEY,
    eventbrite: !!process.env.EVENTBRITE_API_KEY,
    openWeather: !!process.env.OPENWEATHERMAP_API_KEY,
    resend: !!process.env.RESEND_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    adminPassword: !!process.env.ADMIN_PASSWORD,
    deputy: !!process.env.DEPUTY_ACCESS_TOKEN,
  };

  // EKOS hand-off watchdog: how much inventory is waiting to be entered, and
  // whether the oldest of it has been waiting long enough to mean the daily
  // sync is stalled. Best-effort — a storage hiccup must not fail health.
  let inventory:
    | {
        pendingEkos: number;
        oldestPendingDays: number | null;
        syncStalled: boolean;
        catalogDuplicates: string[];
        pendingUnmapped: { count: number; names: string[] };
      }
    | { error: string };
  try {
    const [log, catalog] = await Promise.all([
      readData<InventoryEntry[]>("inventory-log.json"),
      readData<CatalogBeer[]>("inventory-catalog.json"),
    ]);
    const pending = log.filter((e) => !e.reconciledAt);
    const oldestTs = pending.reduce<number | null>((min, e) => {
      const t = new Date(e.timestamp).getTime();
      return Number.isFinite(t) && (min === null || t < min) ? t : min;
    }, null);
    const oldestPendingDays =
      oldestTs === null
        ? null
        : Math.round(((Date.now() - oldestTs) / 86_400_000) * 10) / 10;

    // Rows the resolver can't tell apart even after self-repair — exports
    // pick one arbitrarily, so these need a manual rename in admin.
    const repaired = repairCatalog(catalog).catalog;
    const catalogDuplicates = duplicateCatalogNames(repaired);

    // Pending entries whose beer isn't in the catalog at all (guest taps,
    // one-off kegs): their export row carries no real EKOS item, the sync
    // agent can't enter them, and they'd otherwise sit pending invisibly.
    const known = new Set<string>();
    for (const b of repaired) {
      const n = normalizeBeerName(b.name);
      known.add(n);
      const m = n.match(/^(.+) \d{1,2}oz$/);
      if (m) known.add(m[1]); // bare legacy names still resolve via fallback
    }
    const unmappedEntries = pending.filter(
      (e) => !known.has(normalizeBeerName(e.beerName))
    );
    const pendingUnmapped = {
      count: unmappedEntries.length,
      names: [...new Set(unmappedEntries.map((e) => e.beerName))].sort(),
    };

    inventory = {
      pendingEkos: pending.length,
      oldestPendingDays,
      syncStalled:
        oldestPendingDays !== null && oldestPendingDays > STALE_PENDING_DAYS,
      catalogDuplicates,
      pendingUnmapped,
    };
  } catch {
    inventory = { error: "could not read inventory data" };
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services,
    inventory,
  });
}
