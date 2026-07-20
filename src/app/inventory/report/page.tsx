"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InventoryEntry } from "@/lib/inventory";
import { splitByType, entryLabel } from "@/lib/inventory-report";
import { formatTimeInZone, dateKeyInZone } from "@/lib/timezone";
import { format } from "date-fns";
import { BackToDashboard } from "@/components/BackToDashboard";

type Scope = "unreconciled" | "range";

export default function InventoryReportPage() {
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [scope, setScope] = useState<Scope>("unreconciled");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams({ limit: "500" });
    if (scope === "unreconciled") {
      p.set("scope", "unreconciled");
    } else {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    return p.toString();
  }, [scope, from, to]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory?${query}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setFlash("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  const { tapped, blew, cases } = useMemo(() => splitByType(entries), [entries]);
  const unreconciledIds = useMemo(
    () => entries.filter((e) => !e.reconciledAt).map((e) => e.id),
    [entries]
  );

  const markEntered = async () => {
    if (unreconciledIds.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/inventory/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreconciledIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFlash(data.error || "Failed");
        return;
      }
      showFlash(`Marked ${data.count} entries as entered in EKOS ✓`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  // Reflect a single entry's EKOS status locally (optimistic).
  const setLocalEntered = (id: string, entered: boolean) =>
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, reconciledAt: entered ? new Date().toISOString() : undefined }
          : e
      )
    );

  // Check off (or un-check) one entry as entered into EKOS. Optimistic: the
  // box flips instantly and the row stays visible as done; the reconcile
  // call runs in the background and reverts on failure. This is what Claude
  // Cowork ticks after keying each beer into EKOS.
  const toggleEntered = async (id: string, nextEntered: boolean) => {
    setLocalEntered(id, nextEntered);
    try {
      const res = await fetch("/api/inventory/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          nextEntered ? { ids: [id] } : { ids: [id], undo: true }
        ),
      });
      if (!res.ok) throw new Error();
    } catch {
      setLocalEntered(id, !nextEntered); // revert
      showFlash("Couldn't update — try again");
    }
  };

  const csvUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (scope === "unreconciled") p.set("scope", "unreconciled");
    else {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    return `/api/inventory/export?${p.toString()}`;
  }, [scope, from, to]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <BackToDashboard />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-amber tracking-tight">
              📊 EKOS Report
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Kegs on, kegs off, cases in — check each off as it&apos;s entered in EKOS.
            </p>
          </div>
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
        {/* Scope controls */}
        <section className="bg-card-bg border border-card-border rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setScope("unreconciled")}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                scope === "unreconciled"
                  ? "bg-amber text-background border-amber"
                  : "bg-surface text-foreground border-card-border hover:border-amber"
              }`}
            >
              Not yet in EKOS
            </button>
            <button
              onClick={() => setScope("range")}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                scope === "range"
                  ? "bg-amber text-background border-amber"
                  : "bg-surface text-foreground border-card-border hover:border-amber"
              }`}
            >
              Date range
            </button>
            {scope === "range" && (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="bg-surface border border-card-border rounded px-2 py-1.5 text-foreground"
                />
                <span className="text-muted">to</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="bg-surface border border-card-border rounded px-2 py-1.5 text-foreground"
                />
              </div>
            )}
            <div className="flex-1" />
            <a
              href={csvUrl}
              className="text-sm bg-surface border border-card-border hover:border-amber text-foreground px-4 py-2 rounded-lg transition-colors"
            >
              ⬇ CSV
            </a>
          </div>
        </section>

        {loading ? (
          <p className="text-muted text-sm text-center py-8">Loading…</p>
        ) : entries.length === 0 ? (
          <section className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-foreground font-medium">
              {scope === "unreconciled"
                ? "All caught up — everything is in EKOS."
                : "No activity in this range."}
            </p>
          </section>
        ) : (
          <>
            <ReportGroup
              title="🍺 Kegs ON (tapped)"
              accent="text-amber"
              entries={tapped}
              onToggle={toggleEntered}
            />
            <ReportGroup
              title="💀 Kegs OFF (blew)"
              accent="text-orange-400"
              entries={blew}
              onToggle={toggleEntered}
            />
            <ReportGroup
              title="📦 Cases in"
              accent="text-copper"
              entries={cases}
              onToggle={toggleEntered}
            />

            {unreconciledIds.length > 0 && (
              <button
                onClick={markEntered}
                disabled={busy}
                className="w-full bg-amber text-background font-bold text-lg py-4 rounded-xl hover:bg-copper transition-colors disabled:opacity-50"
              >
                {busy
                  ? "Saving…"
                  : `✓ Mark all ${unreconciledIds.length} as entered in EKOS`}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ReportGroup({
  title,
  accent,
  entries,
  onToggle,
}: {
  title: string;
  accent: string;
  entries: InventoryEntry[];
  onToggle: (id: string, nextEntered: boolean) => void;
}) {
  // Absolute-unit summary per beer, e.g. "Grapefruit IPA · 2 × 1/2 bbl, 1 × 1/6 bbl"
  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const unit =
        e.type === "case-added"
          ? `${e.packSize || "case"}`
          : `${e.size} bbl`;
      const key = `${e.beerName} · ${unit}`;
      counts.set(
        key,
        (counts.get(key) || 0) +
          (e.type === "case-added" ? e.quantity : 1)
      );
    }
    return Array.from(counts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <section className="bg-card-bg border border-card-border rounded-2xl p-5">
      <h2 className={`text-lg font-semibold mb-3 ${accent}`}>
        {title} <span className="text-muted text-sm">({entries.length})</span>
      </h2>

      {/* Summary — the numbers to key into EKOS */}
      <div className="bg-surface/60 rounded-lg p-3 mb-4 border border-card-border/50">
        <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">
          Totals for EKOS
        </p>
        <ul className="space-y-0.5">
          {summary.map(([label, count]) => (
            <li key={label} className="text-sm text-foreground">
              <span className="font-mono font-bold text-amber">{count}×</span>{" "}
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* Individual events — check the box once it's keyed into EKOS */}
      <div className="space-y-1.5">
        {entries.map((e) => {
          const entered = !!e.reconciledAt;
          return (
            <label
              key={e.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer select-none ${
                entered ? "bg-surface/30 opacity-60" : "bg-surface/60"
              }`}
            >
              <input
                type="checkbox"
                checked={entered}
                onChange={(ev) => onToggle(e.id, ev.target.checked)}
                aria-label={`Mark ${entryLabel(e)} as entered in EKOS`}
                className="h-5 w-5 shrink-0 accent-amber cursor-pointer"
              />
              <span
                className={`text-foreground min-w-0 flex-1 truncate ${
                  entered ? "line-through" : ""
                }`}
              >
                {entryLabel(e)}
                {e.note && (
                  <span className="text-muted text-xs"> — {e.note}</span>
                )}
              </span>
              <span className="text-xs text-muted shrink-0">
                {format(new Date(dateKeyInZone(new Date(e.timestamp)) + "T12:00:00"), "MMM d")}{" "}
                {formatTimeInZone(new Date(e.timestamp))}
                {entered && " · in EKOS"}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
