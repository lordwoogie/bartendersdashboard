"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupplyItem } from "@/lib/supplies";
import { formatTimeInZone } from "@/lib/timezone";
import { format, isToday, isYesterday } from "date-fns";
import { BackToDashboard } from "@/components/BackToDashboard";

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
  // Per-form save errors, shown inline until the next attempt succeeds.
  const [buyError, setBuyError] = useState("");
  const [noteError, setNoteError] = useState("");

  const refresh = useCallback(async () => {
    try {
      // no-store: the browser was serving a cached list, so deleted notes and
      // checked-off items came back on the next load.
      const res = await fetch("/api/supplies", { cache: "no-store" });
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

  // Checking off three things in a row used to fire three overlapping writes
  // that collided in storage, and the loser was silently dropped. Queue them
  // so only one is in flight at a time — the UI still updates instantly, the
  // requests just go out one after another.
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = writeQueue.current.then(fn, fn);
    writeQueue.current = run.catch(() => {});
    return run;
  };

  // Adds are optimistic: the item appears and the input clears immediately
  // (venue wifi is flaky; the form must always respond to Enter). The save
  // runs in the background with a hard timeout. On failure the temp item is
  // removed, the typed text is restored, and an inline error appears — a
  // note is never silently eaten.
  const add = (type: "to-buy" | "note", text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const setText = type === "to-buy" ? setBuyText : setNoteText;
    const setError = type === "to-buy" ? setBuyError : setNoteError;

    const temp: SupplyItem = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [temp, ...prev]);
    setText("");
    setError("");

    // Queued with the other writes so an add can't collide with a check-off
    // on the same document. The timeout starts when the request actually
    // goes out, not while it's waiting its turn.
    let timer: ReturnType<typeof setTimeout> | undefined;
    enqueue(() => {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 10000);
      return fetch("/api/supplies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, text: trimmed }),
        signal: controller.signal,
      });
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.item) throw new Error(data.error || "save failed");
        // Swap the temp row for the server's copy (real id).
        setItems((prev) => prev.map((i) => (i.id === temp.id ? data.item : i)));
      })
      .catch(() => {
        // Roll back and hand the text back so nothing is lost.
        setItems((prev) => prev.filter((i) => i.id !== temp.id));
        setText(trimmed);
        setError("Couldn't save — check the wifi and tap the button again.");
      })
      .finally(() => clearTimeout(timer));
  };

  const toggle = async (item: SupplyItem) => {
    if (item.type !== "to-buy") return;
    const wasDone = item.doneAt;
    // Optimistic flip. Functional update so rapid taps don't clobber each
    // other via a stale closure.
    setItems((cur) =>
      cur.map((i) =>
        i.id === item.id && i.type === "to-buy"
          ? { ...i, doneAt: i.doneAt ? undefined : new Date().toISOString() }
          : i
      )
    );
    try {
      const res = await enqueue(() =>
        fetch(`/api/supplies?id=${encodeURIComponent(item.id)}`, {
          method: "PATCH",
          cache: "no-store",
        })
      );
      if (!res.ok) throw new Error("toggle failed");
      // Trust the row the server hands back rather than re-reading the whole
      // list: a refetch fired right after the write could observe the doc
      // mid-flight and visually un-check what was just checked.
      const data = await res.json().catch(() => null);
      if (data?.item) {
        setItems((cur) => cur.map((i) => (i.id === item.id ? data.item : i)));
      }
    } catch {
      // Roll back only this row, so one failure can't undo other check-offs
      // the bartender made while this request was in flight.
      setItems((cur) =>
        cur.map((i) =>
          i.id === item.id && i.type === "to-buy" ? { ...i, doneAt: wasDone } : i
        )
      );
      showFlash("Couldn't save that — try again");
    }
  };

  const remove = async (id: string) => {
    const removed = items.find((i) => i.id === id);
    setItems((cur) => cur.filter((i) => i.id !== id));
    try {
      const res = await enqueue(() =>
        fetch(`/api/supplies?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          cache: "no-store",
        })
      );
      // 404 means it's already gone on the server — that's exactly the end
      // state we want, so treat it as a success instead of springing the row
      // back. Only a real network/server error rolls back. No refetch here
      // either: it would race the write that just landed.
      if (!res.ok && res.status !== 404) throw new Error("delete failed");
    } catch {
      // Put just this row back, leaving any other edits alone.
      if (removed) setItems((cur) => (cur.some((i) => i.id === id) ? cur : [removed, ...cur]));
      showFlash("Couldn't remove that — try again");
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
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <BackToDashboard />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-amber tracking-tight">
              🛒 Supplies
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Things to buy and shift notes for non-beer stuff.
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
              disabled={!buyText.trim()}
              className="bg-amber text-background font-semibold px-6 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </form>
          {buyError && (
            <p className="text-sm text-red-400 mt-2">{buyError}</p>
          )}

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
            className="flex gap-2 mb-1"
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
              disabled={!noteText.trim()}
              className="bg-copper hover:bg-amber text-background font-semibold px-6 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Post
            </button>
          </form>
          {noteError && (
            <p className="text-sm text-red-400 mb-3">{noteError}</p>
          )}
          <div className="mb-3" />

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
