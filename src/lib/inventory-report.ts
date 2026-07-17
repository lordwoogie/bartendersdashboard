// Report/reconcile helpers for feeding inventory movements into EKOS.
// The manager reads absolute events — which keg went ON, which came OFF,
// which cases came in — and keys them into EKOS, then marks the batch
// reconciled so it drops out of the next report.

import type { InventoryEntry, CatalogBeer } from "@/lib/inventory";
import { caseUnitLabel, normalizeBeerName } from "@/lib/inventory";
import { dateKeyInZone, formatTimeInZone } from "@/lib/timezone";

// Resolve an inventory entry's EKOS item name from the catalog's ekosName
// overrides. Keg entries match keg-format catalog rows; case entries match
// can/bottle rows. Falls back to the logged beerName when there's no override.
export function makeEkosNameResolver(
  catalog: CatalogBeer[]
): (entry: InventoryEntry) => string {
  const caseByKey = new Map<string, string>(); // `${format}|${name}` -> ekosName
  const twelveByName = new Map<string, string>(); // name -> 12-pack ekosName
  for (const b of catalog) {
    const n = normalizeBeerName(b.name);
    if (b.ekosName) caseByKey.set(`${b.format}|${n}`, b.ekosName);
    if (b.ekosNameTwelvePack && (b.format === "can" || b.format === "bottle")) {
      twelveByName.set(n, b.ekosNameTwelvePack);
    }
  }
  return (entry) => {
    const n = normalizeBeerName(entry.beerName);
    if (entry.type === "case-added") {
      if (entry.packSize === "12-pack") {
        const t = twelveByName.get(n);
        if (t) return t;
      }
      return caseByKey.get(`can|${n}`) || caseByKey.get(`bottle|${n}`) || entry.beerName;
    }
    return caseByKey.get(`keg|${n}`) || entry.beerName;
  };
}

export interface EntryFilter {
  from?: string; // YYYY-MM-DD inclusive, app-timezone calendar day
  to?: string; // YYYY-MM-DD inclusive
  scope?: "unreconciled" | "all";
}

export function filterEntries(
  entries: InventoryEntry[],
  filter: EntryFilter
): InventoryEntry[] {
  return entries.filter((e) => {
    if (filter.scope !== "all" && e.reconciledAt) return false;
    const day = dateKeyInZone(new Date(e.timestamp));
    if (filter.from && day < filter.from) return false;
    if (filter.to && day > filter.to) return false;
    return true;
  });
}

export function splitByType(entries: InventoryEntry[]) {
  const tapped = entries.filter((e) => e.type === "keg-tapped");
  const blew = entries.filter((e) => e.type === "keg-blew");
  const cases = entries.filter(
    (e): e is Extract<InventoryEntry, { type: "case-added" }> =>
      e.type === "case-added"
  );
  return { tapped, blew, cases };
}

// One human line per entry, e.g. "Grapefruit IPA — 1/2 bbl" or
// "Cowboy Cold — 3 cases (12-pack)".
export function entryLabel(e: InventoryEntry): string {
  if (e.type === "case-added") {
    return `${e.beerName} — ${caseUnitLabel(e.quantity, e.packSize)}`;
  }
  return `${e.beerName} — ${e.size} bbl`;
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(
  entries: InventoryEntry[],
  ekosNameOf?: (entry: InventoryEntry) => string
): string {
  const header = [
    "date",
    "time",
    "event",
    "beer",
    "ekos_name",
    "keg_size",
    "pack_size",
    "quantity",
    "note",
    "entered_in_ekos",
  ];
  const rows = entries.map((e) => {
    const d = new Date(e.timestamp);
    const isCase = e.type === "case-added";
    return [
      dateKeyInZone(d),
      formatTimeInZone(d),
      e.type === "keg-tapped"
        ? "keg tapped (ON)"
        : e.type === "keg-blew"
          ? "keg blew (OFF)"
          : "cases added",
      e.beerName,
      ekosNameOf ? ekosNameOf(e) : e.beerName,
      isCase ? "" : e.size,
      isCase ? e.packSize || "case" : "",
      isCase ? String(e.quantity) : "1",
      e.note || "",
      e.reconciledAt ? "yes" : "no",
    ]
      .map(csvEscape)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n") + "\n";
}

// Simple HTML for the morning-after digest email. Inline styles only —
// email clients ignore stylesheets.
export function digestHtml(entries: InventoryEntry[], dayLabel: string): string {
  const { tapped, blew, cases } = splitByType(entries);

  const section = (title: string, list: InventoryEntry[]) => {
    if (list.length === 0) return "";
    const items = list
      .map(
        (e) =>
          `<li style="margin:4px 0;">${entryLabel(e)} <span style="color:#888;font-size:12px;">(${formatTimeInZone(new Date(e.timestamp))}${e.note ? ` — ${e.note}` : ""})</span></li>`
      )
      .join("");
    return `<h3 style="margin:16px 0 6px;color:#b45309;">${title}</h3><ul style="margin:0;padding-left:20px;">${items}</ul>`;
  };

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222;">
    <h2 style="color:#92400e;">🛢 Inventory activity — ${dayLabel}</h2>
    <p style="color:#555;">Logged on the taproom tablet yesterday. Enter these into EKOS, then mark them reconciled on the report page.</p>
    ${section(`🍺 Kegs ON (tapped) — ${tapped.length}`, tapped)}
    ${section(`💀 Kegs OFF (blew) — ${blew.length}`, blew)}
    ${section(`📦 Cases in — ${cases.length}`, cases)}
    <p style="margin-top:24px;">
      <a href="https://bartendersdashboard.vercel.app/inventory/report" style="background:#d97706;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Open report &amp; reconcile</a>
    </p>
  </div>`;
}
