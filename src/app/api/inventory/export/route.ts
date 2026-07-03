import { readData } from "@/lib/storage";
import type { InventoryEntry } from "@/lib/inventory";
import { filterEntries, toCsv } from "@/lib/inventory-report";

const LOG_DOC = "inventory-log.json";

// GET /api/inventory/export?from=YYYY-MM-DD&to=YYYY-MM-DD&scope=unreconciled
// Returns the filtered log as a CSV download for EKOS bookkeeping.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const scope = searchParams.get("scope") === "unreconciled" ? "unreconciled" : "all";

  const log = await readData<InventoryEntry[]>(LOG_DOC);
  const filtered = filterEntries(log, { from, to, scope }).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(filtered), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${stamp}.csv"`,
    },
  });
}
