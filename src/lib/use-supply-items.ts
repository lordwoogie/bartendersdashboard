"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupplyItem } from "@/lib/supplies";

// Shared data layer for the two pages that read supplies.json: /notes (shift
// notes) and /supplies (the to-buy list). Both need the same optimistic
// updates and the same write queue, and those took several rounds to get
// right — keeping one copy stops the two pages from drifting apart.

export function useSupplyItems() {
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      // no-store: the browser was serving a cached list, so deleted items and
      // check-offs came back on the next load.
      const res = await fetch("/api/supplies", { cache: "no-store" });
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to load supplies:", err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Checking off three things in a row used to fire three overlapping writes
  // that collided in storage, and the loser was silently dropped. Queue them
  // so only one is in flight at a time — the UI still updates instantly, the
  // requests just go out one after another.
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = writeQueue.current.then(fn, fn);
    writeQueue.current = run.catch(() => {});
    return run;
  }, []);

  // Optimistic: the row appears immediately (venue wifi is flaky, the form
  // must always respond to Enter) and the save runs behind it with a hard
  // timeout. Resolves false if it didn't save, so the caller can put the
  // typed text back — nothing is ever silently eaten.
  const add = useCallback(
    async (type: "to-buy" | "note", text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      const temp: SupplyItem = {
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [temp, ...prev]);

      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const res = await enqueue(() => {
          const controller = new AbortController();
          timer = setTimeout(() => controller.abort(), 10000);
          return fetch("/api/supplies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, text: trimmed }),
            signal: controller.signal,
          });
        });
        const data = await res.json();
        if (!res.ok || !data.item) throw new Error(data.error || "save failed");
        // Swap the temp row for the server's copy (real id).
        setItems((prev) => prev.map((i) => (i.id === temp.id ? data.item : i)));
        return true;
      } catch {
        setItems((prev) => prev.filter((i) => i.id !== temp.id));
        return false;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    [enqueue]
  );

  const toggle = useCallback(
    async (item: SupplyItem): Promise<boolean> => {
      if (item.type !== "to-buy") return false;
      const wasDone = item.doneAt;
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
        return true;
      } catch {
        // Roll back only this row, so one failure can't undo other check-offs
        // made while this request was in flight.
        setItems((cur) =>
          cur.map((i) =>
            i.id === item.id && i.type === "to-buy" ? { ...i, doneAt: wasDone } : i
          )
        );
        return false;
      }
    },
    [enqueue]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      let removed: SupplyItem | undefined;
      setItems((cur) => {
        removed = cur.find((i) => i.id === id);
        return cur.filter((i) => i.id !== id);
      });
      try {
        const res = await enqueue(() =>
          fetch(`/api/supplies?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
            cache: "no-store",
          })
        );
        // 404 means it's already gone on the server — exactly the end state we
        // want, so treat it as success instead of springing the row back. No
        // refetch here either: it would race the write that just landed.
        if (!res.ok && res.status !== 404) throw new Error("delete failed");
        return true;
      } catch {
        // Put just this row back, leaving any other edits alone.
        if (removed) {
          const back = removed;
          setItems((cur) => (cur.some((i) => i.id === back.id) ? cur : [back, ...cur]));
        }
        return false;
      }
    },
    [enqueue]
  );

  return { items, loaded, add, toggle, remove, refresh };
}
