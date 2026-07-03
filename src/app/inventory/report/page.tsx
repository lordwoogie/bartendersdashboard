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
              Kegs on, kegs off, cases in — enter these, then mark done.
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
            />
            <ReportGroup
              title="💀 Kegs OFF (blew)"
              accent="text-orange-400"
              entries={blew}
            />
            <ReportGroup
              title="📦 Cases in"
              accent="text-copper"
              entries={cases}
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
}: {
  title: string;
  accent: string;
  entries: InventoryEntry[];
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

      {/* Individual events */}
      <div className="space-y-1.5">
        {entries.map((e) => (
          <div
            key={e.id}
            className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
              e.reconciledAt ? "bg-surface/30 opacity-60" : "bg-surface/60"
            }`}
          >
            <span className="text-foreground min-w-0 truncate">
              {entryLabel(e)}
              {e.note && (
                <span className="text-muted text-xs"> — {e.note}</span>
              )}
            </span>
            <span className="text-xs text-muted shrink-0">
              {format(new Date(dateKeyInZone(new Date(e.timestamp)) + "T12:00:00"), "MMM d")}{" "}
              {formatTimeInZone(new Date(e.timestamp))}
              {e.reconciledAt && " · in EKOS"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
