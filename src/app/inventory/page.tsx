"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CatalogBeer,
  InventoryEntry,
  KegSize,
  PackSize,
} from "@/lib/inventory";
import { formatTimeInZone } from "@/lib/timezone";
import { format, isToday, isYesterday } from "date-fns";

type Mode = "keg-tapped" | "keg-blew" | "case-added";

const MODE_META: Record<
  Mode,
  { label: string; icon: string; verb: string; format: CatalogBeer["format"][] }
> = {
  "keg-tapped": {
    label: "Tap New Keg",
    icon: "🍺",
    verb: "Tapped",
    format: ["keg"],
  },
  "keg-blew": {
    label: "Keg Blew",
    icon: "💀",
    verb: "Blew",
    format: ["keg"],
  },
  "case-added": {
    label: "Add Cases",
    icon: "📦",
    verb: "Restocked",
    format: ["can", "bottle"],
  },
};

const OTHER_VALUE = "__other__";

function entryDayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, MMM d");
}

export default function InventoryPage() {
  const [catalog, setCatalog] = useState<CatalogBeer[]>([]);
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [beerSelect, setBeerSelect] = useState<string>("");
  const [beerCustom, setBeerCustom] = useState("");
  const [size, setSize] = useState<KegSize>("1/2");
  const [packSize, setPackSize] = useState<PackSize>("6-pack");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [catRes, logRes] = await Promise.all([
        fetch("/api/inventory/catalog").then((r) => r.json()),
        fetch("/api/inventory?limit=50").then((r) => r.json()),
      ]);
      setCatalog(catRes.catalog || []);
      setEntries(logRes.entries || []);
    } catch (err) {
      console.error("Failed to load inventory:", err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  const filteredCatalog = useMemo(() => {
    if (!mode) return catalog;
    const allowed = new Set(MODE_META[mode].format);
    return catalog.filter((b) => allowed.has(b.format));
  }, [mode, catalog]);

  const resetForm = () => {
    setMode(null);
    setBeerSelect("");
    setBeerCustom("");
    setSize("1/2");
    setPackSize("6-pack");
    setQuantity(1);
    setNote("");
  };

  const resolvedBeerName = useMemo(() => {
    if (beerSelect === OTHER_VALUE) return beerCustom.trim();
    if (!beerSelect) return "";
    const hit = catalog.find((b) => b.id === beerSelect);
    return hit ? hit.name : "";
  }, [beerSelect, beerCustom, catalog]);

  const canSubmit =
    !!mode &&
    !!resolvedBeerName &&
    (mode === "case-added" ? quantity >= 1 : !!size);

  const submit = async () => {
    if (!mode || !canSubmit) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        type: mode,
        beerName: resolvedBeerName,
        note: note.trim() || undefined,
      };
      if (mode === "case-added") {
        payload.quantity = quantity;
        payload.packSize = packSize;
      } else {
        payload.size = size;
      }

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showFlash(data.error || "Failed to log");
        return;
      }
      setEntries((prev) => [data.entry, ...prev]);
      resetForm();
      showFlash("Logged ✓");
    } finally {
      setBusy(false);
    }
  };

  const undo = async (id: string) => {
    const prev = entries;
    setEntries(entries.filter((e) => e.id !== id));
    const res = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setEntries(prev);
      showFlash("Undo failed");
      return;
    }
    showFlash("Removed");
  };

  const grouped = useMemo(() => {
    const map = new Map<string, InventoryEntry[]>();
    for (const e of entries) {
      const day = entryDayLabel(e.timestamp);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  const catalogIsEmpty = catalog.length === 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber tracking-tight">
              🛢 Inventory
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Log new kegs, blown kegs, and cases as you go.
            </p>
          </div>
          <a href="/" className="text-sm text-muted hover:text-amber">
            ← Dashboard
          </a>
        </div>
      </header>

      {flash && (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <div className="bg-amber/20 text-amber text-sm px-4 py-2 rounded-lg text-center">
            {flash}
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Action buttons */}
        {!mode && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(MODE_META) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="bg-card-bg border border-card-border rounded-2xl p-6 flex flex-col items-center gap-2 hover:border-amber active:scale-[0.98] transition-all"
              >
                <span className="text-5xl">{MODE_META[m].icon}</span>
                <span className="text-lg font-semibold text-foreground">
                  {MODE_META[m].label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Form */}
        {mode && (
          <section className="bg-card-bg border border-card-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-amber flex items-center gap-2">
                <span className="text-2xl">{MODE_META[mode].icon}</span>
                {MODE_META[mode].label}
              </h2>
              <button
                onClick={resetForm}
                className="text-muted hover:text-foreground text-sm"
              >
                Cancel
              </button>
            </div>

            {/* Beer picker */}
            <label className="block text-sm text-muted mb-1">Beer</label>
            {catalogIsEmpty ? (
              <div className="bg-surface/60 border border-card-border rounded-lg px-3 py-2 mb-2 text-sm text-muted">
                No catalog yet. Type the beer name below, or ask an admin to add
                it in{" "}
                <a href="/admin" className="text-amber underline">
                  admin → Inventory Catalog
                </a>
                .
              </div>
            ) : (
              <select
                value={beerSelect}
                onChange={(e) => setBeerSelect(e.target.value)}
                className="w-full bg-surface border border-card-border rounded-lg px-3 py-3 text-lg text-foreground mb-2"
              >
                <option value="">— Select a beer —</option>
                {filteredCatalog.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.brewery ? ` (${b.brewery})` : ""}
                  </option>
                ))}
                <option value={OTHER_VALUE}>Other… (type it in)</option>
              </select>
            )}

            {(catalogIsEmpty || beerSelect === OTHER_VALUE) && (
              <input
                type="text"
                value={beerCustom}
                onChange={(e) => setBeerCustom(e.target.value)}
                placeholder="Beer name"
                autoFocus
                className="w-full bg-surface border border-card-border rounded-lg px-3 py-3 text-lg text-foreground mb-2"
              />
            )}

            {/* Size (keg) or quantity (case) */}
            {mode === "case-added" ? (
              <>
                <div className="mt-4">
                  <label className="block text-sm text-muted mb-1">Pack size</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["4-pack", "6-pack", "12-pack"] as PackSize[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPackSize(p)}
                        className={`rounded-lg border py-3 text-lg font-semibold transition-colors ${
                          packSize === p
                            ? "bg-amber text-background border-amber"
                            : "bg-surface text-foreground border-card-border hover:border-amber"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm text-muted mb-1">
                    How many {packSize}s?
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="bg-surface border border-card-border rounded-lg w-14 h-14 text-2xl font-bold hover:border-amber"
                    >
                      −
                    </button>
                    <div className="flex-1 text-center text-3xl font-bold text-amber">
                      {quantity}
                    </div>
                    <button
                      onClick={() => setQuantity((q) => Math.min(999, q + 1))}
                      className="bg-surface border border-card-border rounded-lg w-14 h-14 text-2xl font-bold hover:border-amber"
                    >
                      +
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4">
                <label className="block text-sm text-muted mb-1">Size</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["1/2", "1/6"] as KegSize[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`rounded-lg border py-4 text-xl font-semibold transition-colors ${
                        size === s
                          ? "bg-amber text-background border-amber"
                          : "bg-surface text-foreground border-card-border hover:border-amber"
                      }`}
                    >
                      {s} bbl
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Optional note */}
            <div className="mt-4">
              <label className="block text-sm text-muted mb-1">
                Note (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. moved from cooler B"
                className="w-full bg-surface border border-card-border rounded-lg px-3 py-3 text-base text-foreground"
              />
            </div>

            <button
              onClick={submit}
              disabled={!canSubmit || busy}
              className="mt-6 w-full bg-amber text-background font-bold text-lg py-4 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-copper transition-colors"
            >
              {busy ? "Saving…" : `Log ${MODE_META[mode].label}`}
            </button>
          </section>
        )}

        {/* Recent activity */}
        <section className="bg-card-bg border border-card-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-4">
            Recent Activity
          </h2>
          {entries.length === 0 ? (
            <p className="text-muted text-sm">
              Nothing logged yet. Tap an action above.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map(([day, dayEntries]) => (
                <div key={day}>
                  <h3 className="text-xs uppercase tracking-wider text-copper font-semibold mb-2">
                    {day}
                  </h3>
                  <div className="space-y-2">
                    {dayEntries.map((e) => {
                      const meta = MODE_META[e.type];
                      return (
                        <div
                          key={e.id}
                          className="flex items-start justify-between gap-3 bg-surface/50 rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground">
                              <span className="mr-1.5">{meta.icon}</span>
                              <span className="font-medium">{meta.verb}</span>{" "}
                              <span className="text-amber">{e.beerName}</span>
                              {e.type === "case-added" ? (
                                <span className="text-muted">
                                  {" "}
                                  · {e.quantity} ×{" "}
                                  {e.packSize || "case"}
                                  {!e.packSize && e.quantity !== 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="text-muted"> · {e.size} bbl</span>
                              )}
                            </div>
                            {e.note && (
                              <div className="text-xs text-muted mt-0.5">
                                {e.note}
                              </div>
                            )}
                            <div className="text-[10px] text-muted mt-0.5">
                              {formatTimeInZone(new Date(e.timestamp))}
                            </div>
                          </div>
                          <button
                            onClick={() => undo(e.id)}
                            className="text-red-400 text-xs hover:text-red-300 shrink-0 mt-0.5"
                          >
                            Undo
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
