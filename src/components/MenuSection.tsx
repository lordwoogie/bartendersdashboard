"use client";

import type { MenuData } from "@/lib/types";

export function MenuSection({ menuData }: { menuData: MenuData }) {
  const { items, changes } = menuData;
  const newItems = changes.filter((c) => c.type === "added");
  const removedItems = changes.filter((c) => c.type === "removed");

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

  // Group by section
  const sections = new Map<string, typeof items>();
  for (const item of items) {
    const section = item.section || "On Tap";
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(item);
  }

  const newItemIds = new Set(newItems.map((c) => c.item.id));

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
      <h2 className="text-lg font-semibold text-amber flex items-center gap-2 mb-4">
        <span className="text-xl">🍺</span> Tap List
        {newItems.length > 0 && (
          <span className="bg-amber/20 text-amber text-xs px-2 py-0.5 rounded-full font-medium">
            {newItems.length} new
          </span>
        )}
      </h2>

      {newItems.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber/10 border border-amber/30">
          <p className="text-sm font-semibold text-amber mb-2">New On Tap</p>
          {newItems.map((change) => (
            <div
              key={change.item.id}
              className="text-sm text-foreground animate-glow-new rounded px-2 py-1 mb-1"
            >
              <span className="mr-1">🆕</span>
              <span className="font-medium">{change.item.name}</span>
              {change.item.brewery && (
                <span className="text-muted"> &middot; {change.item.brewery}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {removedItems.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-surface border border-card-border">
          <p className="text-xs font-medium text-muted mb-1">Recently Pulled</p>
          {removedItems.map((change) => (
            <p key={change.item.id} className="text-xs text-muted/70 line-through">
              {change.item.name}
            </p>
          ))}
        </div>
      )}

      {Array.from(sections.entries()).map(([sectionName, sectionItems]) => (
        <div key={sectionName} className="mb-4 last:mb-0">
          <h3 className="text-xs uppercase tracking-wider text-copper font-semibold mb-2">
            {sectionName}
          </h3>
          <div className="grid gap-1.5">
            {sectionItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                  newItemIds.has(item.id)
                    ? "bg-amber/10 border border-amber/20 animate-glow-new"
                    : "bg-surface/50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">
                    {newItemIds.has(item.id) && <span className="mr-1">🆕</span>}
                    {item.name}
                  </span>
                  {item.brewery && (
                    <span className="text-muted text-xs ml-2">{item.brewery}</span>
                  )}
                  {item.style && (
                    <span className="text-muted/60 text-xs ml-2">{item.style}</span>
                  )}
                </div>
                {item.abv && (
                  <span className="text-xs text-amber font-mono shrink-0 ml-2">
                    {item.abv}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
