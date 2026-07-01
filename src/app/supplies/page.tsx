"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupplyItem } from "@/lib/supplies";
import { formatTimeInZone } from "@/lib/timezone";
import { format, isToday, isYesterday } from "date-fns";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, MMM d");
}

export default function SuppliesPage() {
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [buyText, setBuyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/supplies");
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to load supplies:", err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2000);
  };

  const add = async (type: "to-buy" | "note", text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/supplies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFlash(data.error || "Failed to add");
        return;
      }
      // Refetch to get server-sorted order (to-buy above notes).
      await refresh();
      if (type === "to-buy") setBuyText("");
      else setNoteText("");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: SupplyItem) => {
    if (item.type !== "to-buy") return;
    const prev = items;
    // Optimistic flip.
    setItems(
      items.map((i) =>
        i.id === item.id && i.type === "to-buy"
          ? { ...i, doneAt: i.doneAt ? undefined : new Date().toISOString() }
          : i
      )
    );
    const res = await fetch(`/api/supplies?id=${encodeURIComponent(item.id)}`, {
      method: "PATCH",
    });
    if (!res.ok) {
      setItems(prev);
      showFlash("Toggle failed");
    }
  };

  const remove = async (id: string) => {
    const prev = items;
    setItems(items.filter((i) => i.id !== id));
    const res = await fetch(`/api/supplies?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setItems(prev);
      showFlash("Delete failed");
    }
  };

  const { active, done, notes } = useMemo(() => {
    const active: SupplyItem[] = [];
    const done: SupplyItem[] = [];
    const notes: SupplyItem[] = [];
    for (const i of items) {
      if (i.type === "to-buy") {
        if (i.doneAt) done.push(i);
        else active.push(i);
      } else {
        notes.push(i);
      }
    }
    return { active, done, notes };
  }, [items]);

  const notesByDay = useMemo(() => {
    const map = new Map<string, SupplyItem[]>();
    for (const n of notes) {
      const key = dayLabel(n.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return Array.from(map.entries());
  }, [notes]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber tracking-tight">
              🛒 Supplies
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Things to buy and shift notes for non-beer stuff.
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
        {/* To buy */}
        <section className="bg-card-bg border border-card-border rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-amber mb-4">
            🛒 To Buy
          </h2>

          {active.length === 0 ? (
            <p className="text-muted text-sm mb-4">Nothing to buy — add items below.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {active.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 bg-surface rounded-lg px-3 py-3"
                >
                  <button
                    onClick={() => toggle(item)}
                    aria-label="Mark done"
                    className="w-8 h-8 shrink-0 rounded-md border-2 border-copper/50 hover:border-amber flex items-center justify-center"
                  />
                  <span className="flex-1 text-base text-foreground">
                    {item.text}
                  </span>
                  <button
                    onClick={() => remove(item.id)}
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
              add("to-buy", buyText);
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
              disabled={!buyText.trim() || busy}
              className="bg-amber text-background font-semibold px-6 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </form>

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
                      onClick={() => toggle(item)}
                      aria-label="Mark not done"
                      className="w-6 h-6 shrink-0 rounded-md bg-amber/70 text-background flex items-center justify-center text-sm font-bold"
                    >
                      ✓
                    </button>
                    <span className="flex-1 text-sm text-muted line-through">
                      {item.text}
                    </span>
                    <button
                      onClick={() => remove(item.id)}
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

        {/* Shift notes */}
        <section className="bg-card-bg border border-card-border rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-amber mb-4">
            📝 Shift Notes
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              add("note", noteText);
            }}
            className="flex gap-2 mb-4"
          >
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Ice machine is leaking, used the last of the bar rags"
              className="flex-1 bg-surface border border-card-border rounded-lg px-3 py-3 text-base text-foreground"
            />
            <button
              type="submit"
              disabled={!noteText.trim() || busy}
              className="bg-copper hover:bg-amber text-background font-semibold px-6 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Post
            </button>
          </form>

          {notesByDay.length === 0 ? (
            <p className="text-muted text-sm">No notes yet.</p>
          ) : (
            <div className="space-y-5">
              {notesByDay.map(([day, dayNotes]) => (
                <div key={day}>
                  <h3 className="text-xs uppercase tracking-wider text-copper font-semibold mb-2">
                    {day}
                  </h3>
                  <div className="space-y-2">
                    {dayNotes.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start justify-between gap-3 bg-surface/50 rounded-lg px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {n.text}
                          </p>
                          <p className="text-[10px] text-muted mt-0.5">
                            {formatTimeInZone(new Date(n.createdAt))}
                          </p>
                        </div>
                        <button
                          onClick={() => remove(n.id)}
                          className="text-red-400 text-xs hover:text-red-300 shrink-0 mt-0.5"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
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
