"use client";

import { useMemo, useState } from "react";
import type { SupplyItem } from "@/lib/supplies";
import { formatTimeInZone } from "@/lib/timezone";
import { format, isToday, isYesterday } from "date-fns";
import { BackToDashboard } from "@/components/BackToDashboard";
import { useSupplyItems } from "@/lib/use-supply-items";

// Shift notes, on their own page. These used to share /supplies with the
// shopping list, which buried them — notes are read every shift, the to-buy
// list is a weekly errand.

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, MMM d");
}

export default function NotesPage() {
  const { items, loaded, add, remove } = useSupplyItems();
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState("");
  const [flash, setFlash] = useState("");

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2000);
  };

  const notes = useMemo(
    () => items.filter((i): i is Extract<SupplyItem, { type: "note" }> => i.type === "note"),
    [items]
  );

  const notesByDay = useMemo(() => {
    const map = new Map<string, SupplyItem[]>();
    for (const n of notes) {
      const key = dayLabel(n.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return Array.from(map.entries());
  }, [notes]);

  const submit = async () => {
    const text = noteText;
    if (!text.trim()) return;
    setNoteText("");
    setNoteError("");
    const ok = await add("note", text);
    if (!ok) {
      // Hand the text back so a flaky-wifi save never eats a note.
      setNoteText(text);
      setNoteError("Couldn't save — check the wifi and tap Post again.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <BackToDashboard />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-amber tracking-tight">
              📝 Shift Notes
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Anything the next shift should know.
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex gap-2"
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
          {noteError && <p className="text-sm text-critical mt-2">{noteError}</p>}

          <div className="mt-6">
            {!loaded ? (
              <p className="text-muted text-sm">Loading…</p>
            ) : notesByDay.length === 0 ? (
              <p className="text-muted text-sm">
                No notes yet. Add the first one above.
              </p>
            ) : (
              <div className="space-y-5">
                {notesByDay.map(([day, dayNotes]) => (
                  <div key={day}>
                    <h2 className="text-xs uppercase tracking-wider text-copper font-semibold mb-2">
                      {day}
                    </h2>
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
                            onClick={async () => {
                              if (!(await remove(n.id))) {
                                showFlash("Couldn't remove that — try again");
                              }
                            }}
                            className="text-critical text-xs hover:text-critical/80 shrink-0 mt-0.5"
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
          </div>
        </section>
      </main>
    </div>
  );
}
