"use client";

import { useMemo, useState } from "react";
import type { SupplyItem } from "@/lib/supplies";
import { BackToDashboard } from "@/components/BackToDashboard";
import { useSupplyItems } from "@/lib/use-supply-items";

// The shopping list. Shift notes used to live on this page too; they now have
// their own page at /notes so neither buries the other.

export default function SuppliesPage() {
  const { items, loaded, add, toggle, remove } = useSupplyItems();
  const [buyText, setBuyText] = useState("");
  const [buyError, setBuyError] = useState("");
  const [flash, setFlash] = useState("");

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2000);
  };

  const { active, done } = useMemo(() => {
    const active: SupplyItem[] = [];
    const done: SupplyItem[] = [];
    for (const i of items) {
      if (i.type !== "to-buy") continue;
      if (i.doneAt) done.push(i);
      else active.push(i);
    }
    return { active, done };
  }, [items]);

  const submit = async () => {
    const text = buyText;
    if (!text.trim()) return;
    setBuyText("");
    setBuyError("");
    const ok = await add("to-buy", text);
    if (!ok) {
      // Hand the text back so a flaky-wifi save never eats an item.
      setBuyText(text);
      setBuyError("Couldn't save — check the wifi and tap the button again.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <BackToDashboard />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-amber tracking-tight">
              🛒 Supplies
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Non-beer things we need to buy.
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
        <section className="bg-card-bg border border-card-border rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-amber mb-4">🛒 To Buy</h2>

          {!loaded ? (
            <p className="text-muted text-sm mb-4">Loading…</p>
          ) : active.length === 0 ? (
            <p className="text-muted text-sm mb-4">
              Nothing to buy — add items below.
            </p>
          ) : (
            <ul className="space-y-2 mb-4">
              {active.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 bg-surface rounded-lg px-3 py-3"
                >
                  <button
                    onClick={async () => {
                      if (!(await toggle(item))) {
                        showFlash("Couldn't save that — try again");
                      }
                    }}
                    aria-label="Mark done"
                    className="w-8 h-8 shrink-0 rounded-md border-2 border-copper/50 hover:border-amber flex items-center justify-center"
                  />
                  <span className="flex-1 text-base text-foreground">
                    {item.text}
                  </span>
                  <button
                    onClick={async () => {
                      if (!(await remove(item.id))) {
                        showFlash("Couldn't remove that — try again");
                      }
                    }}
                    className="text-red-400 text-xs hover:text-red-300"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={buyText}
              onChange={(e) => setBuyText(e.target.value)}
              placeholder="e.g. Coke, Capri Suns, limes"
              className="flex-1 bg-surface border border-card-border rounded-lg px-3 py-3 text-base text-foreground"
            />
            <button
              type="submit"
              disabled={!buyText.trim()}
              className="bg-amber text-background font-semibold px-6 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </form>
          {buyError && <p className="text-sm text-red-400 mt-2">{buyError}</p>}

          {done.length > 0 && (
            <details className="mt-6">
              <summary className="text-xs text-muted cursor-pointer hover:text-amber">
                Recently purchased ({done.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {done.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 bg-surface/40 rounded px-3 py-2"
                  >
                    <button
                      onClick={async () => {
                        if (!(await toggle(item))) {
                          showFlash("Couldn't save that — try again");
                        }
                      }}
                      aria-label="Mark not done"
                      className="w-6 h-6 shrink-0 rounded-md bg-amber/70 text-background flex items-center justify-center text-sm font-bold"
                    >
                      ✓
                    </button>
                    <span className="flex-1 text-sm text-muted line-through">
                      {item.text}
                    </span>
                    <button
                      onClick={async () => {
                        if (!(await remove(item.id))) {
                          showFlash("Couldn't remove that — try again");
                        }
                      }}
                      className="text-red-400/70 text-xs hover:text-red-300"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </main>
    </div>
  );
}
