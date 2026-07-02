"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import type { SupplyItem } from "@/lib/supplies";

// Compact "from the last shift" card at the top of the dashboard so shift
// notes and open shopping items are actually seen. Renders nothing when
// there's nothing to show, so it doesn't waste dashboard real estate.

function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "EEE h:mm a");
}

export function SuppliesSection() {
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/supplies")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(data.items || []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const openBuy = items.filter(
    (i): i is Extract<SupplyItem, { type: "to-buy" }> =>
      i.type === "to-buy" && !i.doneAt
  );
  const notes = items
    .filter((i): i is Extract<SupplyItem, { type: "note" }> => i.type === "note")
    .slice(0, 3);

  if (!loaded) return null;
  if (openBuy.length === 0 && notes.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-copper/40 bg-gradient-to-br from-card-bg to-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-amber uppercase tracking-wider">
          From the last shift
        </h2>
        <Link
          href="/supplies"
          className="text-xs text-copper hover:text-amber transition-colors"
        >
          Open supplies →
        </Link>
      </div>

      {openBuy.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg">🛒</span>
            <span className="text-sm font-medium text-foreground">
              {openBuy.length} still to buy
            </span>
          </div>
          <ul className="text-sm text-muted pl-7 space-y-0.5">
            {openBuy.slice(0, 4).map((item) => (
              <li key={item.id} className="truncate">
                • {item.text}
              </li>
            ))}
            {openBuy.length > 4 && (
              <li className="text-xs text-copper">
                + {openBuy.length - 4} more…
              </li>
            )}
          </ul>
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg">📝</span>
            <span className="text-sm font-medium text-foreground">
              Recent notes
            </span>
          </div>
          <ul className="pl-7 space-y-1.5">
            {notes.map((n) => (
              <li key={n.id} className="text-sm text-foreground/90">
                <span className="text-[10px] text-muted uppercase tracking-wider block">
                  {whenLabel(n.createdAt)}
                </span>
                <span className="whitespace-pre-wrap">{n.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
