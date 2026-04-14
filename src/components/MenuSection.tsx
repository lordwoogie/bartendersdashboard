"use client";

import type { MenuData } from "@/lib/types";

export function MenuSection({ menuData }: { menuData: MenuData }) {
  const { items, changes } = menuData;
  const newItems = changes.filter((c) => c.type === "added");
  const removedItems = changes.filter((c) => c.type === "removed");

  // No menu data at all
  if (items.length === 0 && changes.length === 0) {
    return (
      <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
        <h2 className="text-lg font-semibold text-amber flex items-center gap-2">
          <span className="text-xl">🍺</span> Tap List
        </h2>
        <p className="text-muted mt-2 text-sm">
          Configure UNTAPPD_API_KEY to see the live tap list.
        </p>
      </section>
    );
  }

  // No changes — just show a link to the full list
  if (newItems.length === 0 && removedItems.length === 0) {
    return (
      <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber flex items-center gap-2">
            <span className="text-xl">🍺</span> Tap List
          </h2>
          <a
            href="/beers"
            className="text-xs bg-surface hover:bg-card-border text-foreground px-3 py-1.5 rounded-lg transition-colors"
          >
            View all {items.length} beers →
          </a>
        </div>
        <p className="text-muted mt-2 text-sm">No tap changes today.</p>
      </section>
    );
  }

  // Has changes — show new/removed beers
  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-amber flex items-center gap-2">
          <span className="text-xl">🍺</span> Tap List
          {newItems.length > 0 && (
            <span className="bg-amber/20 text-amber text-xs px-2 py-0.5 rounded-full font-medium">
              {newItems.length} new
            </span>
          )}
        </h2>
        <a
          href="/beers"
          className="text-xs bg-surface hover:bg-card-border text-foreground px-3 py-1.5 rounded-lg transition-colors"
        >
          Full list →
        </a>
      </div>

      {newItems.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber/10 border border-amber/30">
          <p className="text-sm font-semibold text-amber mb-2">New On Tap</p>
          {newItems.map((change) => (
            <div
              key={change.item.id}
              className="flex items-center justify-between text-sm text-foreground animate-glow-new rounded px-2 py-1.5 mb-1"
            >
              <div>
                <span className="mr-1">🆕</span>
                <span className="font-medium">{change.item.name}</span>
                {change.item.style && (
                  <span className="text-muted text-xs ml-2">{change.item.style}</span>
                )}
              </div>
              {change.item.abv && (
                <span className="text-xs text-amber font-mono shrink-0 ml-2">
                  {change.item.abv}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {removedItems.length > 0 && (
        <div className="p-3 rounded-lg bg-surface border border-card-border">
          <p className="text-xs font-medium text-muted mb-1">Recently Pulled</p>
          {removedItems.map((change) => (
            <p key={change.item.id} className="text-xs text-muted/70 line-through">
              {change.item.name}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
