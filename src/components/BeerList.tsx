"use client";

import { useState, useEffect, useCallback } from "react";
import type { MenuItem, MenuChange } from "@/lib/types";
import { getStyleDescription, getBjcpStyleName } from "@/lib/style-matcher";

export function BeerList() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [changes, setChanges] = useState<MenuChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/menu");
      const data = await res.json();
      if (data.menu) {
        setItems(data.menu.items || []);
        setChanges(data.menu.changes || []);
      }
      if (data.error) setError(data.error);
    } catch {
      setError("Failed to load menu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const newItemNames = new Set(
    changes.filter((c) => c.type === "added").map((c) => c.item.name.toLowerCase())
  );

  // Group by section
  const sections = new Map<string, MenuItem[]>();
  for (const item of items) {
    const section = item.section || "On Tap";
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(item);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Cowboy Cold Beer List
            </h1>
            <p className="text-sm text-muted mt-0.5">
              {items.length} beers on tap · Lively Beerworks
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-xs text-muted hover:text-amber transition-colors"
            >
              Dashboard
            </a>
            <button
              onClick={fetchMenu}
              disabled={loading}
              className="text-xs bg-surface hover:bg-card-border text-foreground px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">🍺</div>
              <p className="text-muted">Loading beer list...</p>
            </div>
          </div>
        ) : error && items.length === 0 ? (
          <div className="rounded-xl border border-card-border bg-card-bg p-6 text-center">
            <p className="text-muted">{error}</p>
          </div>
        ) : (
          Array.from(sections.entries()).map(([sectionName, sectionItems]) => (
            <div key={sectionName} className="mb-8">
              <h2 className="text-sm uppercase tracking-wider text-copper font-semibold mb-3 flex items-center gap-2">
                <span>🍺</span>
                {sectionName}
                <span className="text-xs text-muted font-normal">
                  ({sectionItems.length})
                </span>
              </h2>

              <div className="space-y-3">
                {sectionItems.map((item) => {
                  const isNew = newItemNames.has(item.name.toLowerCase());
                  const isExpanded = expandedId === item.id;
                  const styleDesc = item.style
                    ? getStyleDescription(item.style)
                    : null;
                  const bjcpName = item.style
                    ? getBjcpStyleName(item.style)
                    : null;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border bg-card-bg overflow-hidden transition-all ${
                        isNew
                          ? "border-amber/40 animate-glow-new"
                          : "border-card-border"
                      }`}
                    >
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : item.id)
                        }
                        className="w-full text-left px-4 py-3 flex items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isNew && <span className="text-sm">🆕</span>}
                            <h3 className="font-semibold text-foreground truncate">
                              {item.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.style && (
                              <span className="text-xs text-muted">
                                {item.style}
                              </span>
                            )}
                            {item.brewery && (
                              <span className="text-xs text-muted/60">
                                · {item.brewery}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-3">
                          {item.abv && (
                            <span className="text-sm font-mono text-amber font-semibold">
                              {item.abv}%
                            </span>
                          )}
                          <span
                            className="text-muted text-xs transition-transform duration-200"
                            style={{
                              transform: isExpanded
                                ? "rotate(180deg)"
                                : "rotate(0)",
                            }}
                          >
                            ▾
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-card-border/50">
                          <div className="pt-3 space-y-3">
                            {/* Beer details */}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {item.style && (
                                <div>
                                  <span className="text-muted text-xs block">
                                    Style
                                  </span>
                                  <span className="text-foreground">
                                    {item.style}
                                  </span>
                                </div>
                              )}
                              {item.abv && (
                                <div>
                                  <span className="text-muted text-xs block">
                                    ABV
                                  </span>
                                  <span className="text-amber font-semibold">
                                    {item.abv}%
                                  </span>
                                </div>
                              )}
                              {item.brewery && (
                                <div>
                                  <span className="text-muted text-xs block">
                                    Brewery
                                  </span>
                                  <span className="text-foreground">
                                    {item.brewery}
                                  </span>
                                </div>
                              )}
                              {bjcpName && (
                                <div>
                                  <span className="text-muted text-xs block">
                                    BJCP Style
                                  </span>
                                  <span className="text-copper text-sm">
                                    {bjcpName}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* BJCP Style Description */}
                            {styleDesc && (
                              <div className="bg-surface/50 rounded-lg p-3 border border-card-border/30">
                                <p className="text-xs text-copper font-semibold mb-1 uppercase tracking-wider">
                                  About this style
                                </p>
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                  {styleDesc}
                                </p>
                              </div>
                            )}

                            {item.description && (
                              <div>
                                <p className="text-xs text-muted mb-1">
                                  Description
                                </p>
                                <p className="text-sm text-foreground/80">
                                  {item.description}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
