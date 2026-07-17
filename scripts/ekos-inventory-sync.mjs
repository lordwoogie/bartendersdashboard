#!/usr/bin/env node
/*
 * EKOS inventory hand-off.
 *
 * Run this from your EKOS "POS sync" scheduled program EACH MORNING, BEFORE
 * the 5 AM sync. It:
 *   1. Pulls the taproom inventory that hasn't been entered into EKOS yet
 *      (kegs tapped / kegs blown / cases added, logged on the tablet).
 *   2. Writes a CSV you can import into EKOS.
 *   3. (with --reconcile) marks those exact entries as transferred so the
 *      next morning's run won't include them again.
 *
 * Requires Node 18+ (uses built-in fetch). No npm install needed.
 *
 * Usage:
 *   node ekos-inventory-sync.mjs [--out <path>] [--reconcile] [--all] [--base <url>]
 *
 * Flags:
 *   --out <path>   Where to write the CSV.
 *                  Default: ./ekos-inventory-YYYY-MM-DD.csv in the cwd.
 *   --reconcile    After the CSV is written, mark the pulled entries as
 *                  "in EKOS" so they drop off tomorrow's list. Leave this
 *                  OFF while you're testing; turn it on once you trust the
 *                  import so entries never double-count.
 *   --all          Include entries already marked transferred too
 *                  (default: only entries NOT yet in EKOS).
 *   --base <url>   Dashboard base URL. Default:
 *                  env DASHBOARD_URL, else the production URL below.
 *
 * Exit codes: 0 = success (including "nothing to transfer"), 1 = error.
 */

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const BASE = (opt("--base", process.env.DASHBOARD_URL) ||
  "https://bartendersdashboard.vercel.app").replace(/\/+$/, "");
const scope = has("--all") ? "all" : "unreconciled";
const doReconcile = has("--reconcile");

// Local calendar date for the default filename.
const stamp = new Date().toISOString().slice(0, 10);
const outPath = opt("--out", `./ekos-inventory-${stamp}.csv`);

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function eventLabel(type) {
  if (type === "keg-tapped") return "keg tapped (ON)";
  if (type === "keg-blew") return "keg blew (OFF)";
  return "cases added";
}

function normalizeBeerName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Build a resolver from the catalog's EKOS-name overrides. Keg entries match
// keg-format rows; case entries match can/bottle rows. Falls back to the
// logged beer name.
function makeEkosNameResolver(catalog) {
  const caseByKey = new Map();
  const twelveByName = new Map();
  for (const b of catalog || []) {
    if (!b) continue;
    const n = normalizeBeerName(b.name);
    if (b.ekosName) caseByKey.set(`${b.format}|${n}`, b.ekosName);
    if (b.ekosNameTwelvePack && (b.format === "can" || b.format === "bottle")) {
      twelveByName.set(n, b.ekosNameTwelvePack);
    }
  }
  return (e) => {
    const n = normalizeBeerName(e.beerName);
    if (e.type === "case-added") {
      if (e.packSize === "12-pack") {
        const t = twelveByName.get(n);
        if (t) return t;
      }
      return caseByKey.get(`can|${n}`) || caseByKey.get(`bottle|${n}`) || e.beerName;
    }
    // Kegs: EKOS names them "{base} (Keg - 1/2 bbl)" / "(Keg - 1/6 bbl)".
    const base = caseByKey.get(`keg|${n}`) || e.beerName;
    return `${base} (Keg - ${e.size} bbl)`;
  };
}

function toCsv(entries, ekosNameOf) {
  const header = [
    "date",
    "time",
    "event",
    "beer",
    "ekos_name",
    "keg_size",
    "pack",
    "quantity",
    "note",
  ];
  const rows = entries.map((e) => {
    const d = new Date(e.timestamp);
    // en-CA => YYYY-MM-DD; both formatted in Central so they match the app.
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
    const isCase = e.type === "case-added";
    return [
      date,
      time,
      eventLabel(e.type),
      e.beerName,
      ekosNameOf ? ekosNameOf(e) : e.beerName,
      isCase ? "" : e.size,
      isCase ? e.packSize || "case" : "",
      isCase ? String(e.quantity) : "1",
      e.note || "",
    ]
      .map(csvEscape)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n") + "\n";
}

async function main() {
  const fs = await import("node:fs/promises");

  // 1. Pull the entries that still need to go into EKOS, plus the catalog
  //    (for EKOS-name overrides).
  const listUrl = `${BASE}/api/inventory?scope=${scope}&limit=500`;
  const [res, catRes] = await Promise.all([
    fetch(listUrl),
    fetch(`${BASE}/api/inventory/catalog`),
  ]);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${listUrl}`);
  const { entries } = await res.json();
  const catalog = catRes.ok ? (await catRes.json()).catalog || [] : [];

  if (!entries || entries.length === 0) {
    console.log("Nothing to transfer — inventory is already up to date in EKOS.");
    return;
  }

  // Oldest-first reads naturally for an import file.
  entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // 2. Write the CSV (with resolved EKOS names).
  const ekosNameOf = makeEkosNameResolver(catalog);
  await fs.writeFile(outPath, toCsv(entries, ekosNameOf), "utf-8");
  console.log(`Wrote ${entries.length} entr${entries.length === 1 ? "y" : "ies"} to ${outPath}`);

  // 3. Optionally mark them transferred.
  if (doReconcile) {
    const ids = entries.map((e) => e.id);
    const rec = await fetch(`${BASE}/api/inventory/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!rec.ok) {
      throw new Error(
        `CSV written, but marking entries transferred FAILED: ${rec.status}. ` +
          `Re-run with --reconcile after confirming the import, or reconcile in the app.`
      );
    }
    const out = await rec.json();
    console.log(`Marked ${out.count} entries as transferred to EKOS.`);
  } else {
    console.log(
      "Entries were NOT marked transferred (no --reconcile). They will appear " +
        "again next run until reconciled here or in the app's EKOS Report."
    );
  }
}

main().catch((err) => {
  console.error("EKOS inventory sync failed:", err.message || err);
  process.exit(1);
});
