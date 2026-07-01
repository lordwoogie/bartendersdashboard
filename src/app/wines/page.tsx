"use client";

import { useEffect, useMemo, useState } from "react";
import type { Wine, WineCategory } from "@/lib/wine";

const CATEGORY_ORDER: WineCategory[] = [
  "sparkling",
  "white",
  "orange",
  "rose",
  "red",
  "dessert",
];

const CATEGORY_LABEL: Record<WineCategory, string> = {
  sparkling: "Sparkling",
  white: "White",
  orange: "Orange",
  rose: "Rosé",
  red: "Red",
  dessert: "Dessert",
};

const CATEGORY_ICON: Record<WineCategory, string> = {
  sparkling: "🥂",
  white: "🥂",
  orange: "🍊",
  rose: "🌹",
  red: "🍷",
  dessert: "🍯",
};

function priceLabel(v?: number): string {
  if (v === undefined) return "—";
  // Show integer dollars if whole, else two decimals.
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

export default function WinesPage() {
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wines")
      .then((r) => r.json())
      .then((data) => setWines(data.wines || []))
      .catch(() => setWines([]))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<WineCategory, Wine[]>();
    for (const w of wines) {
      if (!map.has(w.category)) map.set(w.category, []);
      map.get(w.category)!.push(w);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map(
      (c) => [c, map.get(c)!] as const
    );
  }, [wines]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber tracking-tight">
              🍷 Wine List
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Tap a card for tasting notes.
            </p>
          </div>
          <a href="/" className="text-sm text-muted hover:text-amber">
            ← Dashboard
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : wines.length === 0 ? (
          <section className="bg-card-bg border border-card-border rounded-2xl p-6 text-sm text-muted">
            No wines yet. An admin can add them in{" "}
            <a href="/admin" className="text-amber underline">
              admin → Wine List
            </a>
            .
          </section>
        ) : (
          grouped.map(([category, list]) => (
            <section key={category}>
              <h2 className="text-lg font-semibold text-amber mb-3 flex items-center gap-2">
                <span className="text-xl">{CATEGORY_ICON[category]}</span>
                {CATEGORY_LABEL[category]}
              </h2>
              <div className="grid gap-3">
                {list.map((w) => (
                  <WineCard key={w.id} wine={w} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

function WineCard({ wine }: { wine: Wine }) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(wine.notes || wine.varietal || wine.region);

  const subhead = [wine.varietal, wine.region, wine.vintage]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-xl bg-gradient-to-r from-surface to-surface/60 border border-copper/30 p-4">
      <button
        type="button"
        onClick={() => hasDetails && setOpen((o) => !o)}
        aria-expanded={hasDetails ? open : undefined}
        className={`w-full text-left flex items-start justify-between gap-3 ${
          hasDetails ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground flex items-center gap-1.5">
            {wine.name}
            {hasDetails && (
              <span
                className={`text-copper text-xs transition-transform ${
                  open ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
            )}
          </h3>
          {wine.producer && (
            <p className="text-xs text-muted mt-0.5">{wine.producer}</p>
          )}
          {subhead && (
            <p className="text-xs text-copper/80 mt-0.5">{subhead}</p>
          )}
        </div>
        <div className="text-right shrink-0 text-sm">
          {wine.glassPrice !== undefined && (
            <p className="text-amber font-medium">
              Glass {priceLabel(wine.glassPrice)}
            </p>
          )}
          {wine.bottlePrice !== undefined && (
            <p className="text-muted">
              Bottle {priceLabel(wine.bottlePrice)}
            </p>
          )}
          {wine.abv !== undefined && (
            <p className="text-[10px] text-muted mt-0.5">{wine.abv}% ABV</p>
          )}
        </div>
      </button>

      {open && wine.notes && (
        <p className="mt-3 pt-3 border-t border-copper/20 text-sm text-muted/90 whitespace-pre-line leading-relaxed">
          {wine.notes}
        </p>
      )}
    </div>
  );
}
