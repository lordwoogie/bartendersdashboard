import { NextResponse } from "next/server";
import { readData } from "@/lib/storage";
import type { ReconcileRecord } from "@/lib/inventory";
import { dateKeyInZone, formatTimeInZone } from "@/lib/timezone";

const ARCHIVE_DOC = "ekos-reconcile-archive.json";

const EVENT_LABEL: Record<ReconcileRecord["type"], string> = {
  "keg-tapped": "keg tapped (ON)",
  "keg-blew": "keg blew (OFF)",
  "case-added": "cases added",
};

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// GET /api/inventory/ekos-history
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   filter by the day it was ENTERED in EKOS
//   ?format=csv                       download as CSV (default: JSON)
//
// The durable, year-long record of every inventory movement checked off into
// EKOS: what it was, its EKOS item name, when it physically happened, and
// when it was entered. Survives the live activity log's size cap.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const asCsv = searchParams.get("format") === "csv";

  const archive = await readData<ReconcileRecord[]>(ARCHIVE_DOC);
  const records = archive
    .filter((r) => {
      const day = dateKeyInZone(new Date(r.enteredAt));
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    })
    .sort(
      (a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime()
    );

  if (!asCsv) {
    return NextResponse.json({ records });
  }

  const header = [
    "entered_date",
    "entered_time",
    "logged_date",
    "logged_time",
    "event",
    "beer",
    "ekos_name",
    "keg_size",
    "pack_size",
    "quantity",
    "note",
    "id",
  ];
  const rows = records.map((r) => {
    const entered = new Date(r.enteredAt);
    const logged = new Date(r.loggedAt);
    return [
      dateKeyInZone(entered),
      formatTimeInZone(entered),
      dateKeyInZone(logged),
      formatTimeInZone(logged),
      EVENT_LABEL[r.type],
      r.beerName,
      r.ekosName,
      r.size || "",
      r.packSize || "",
      r.type === "case-added" ? String(r.quantity ?? "") : "1",
      r.note || "",
      r.id,
    ]
      .map((v) => csvEscape(String(v)))
      .join(",");
  });
  const csv = [header.join(","), ...rows].join("\n") + "\n";

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ekos-history-${stamp}.csv"`,
    },
  });
}
