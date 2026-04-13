"use client";

import type { LocalEvent } from "@/lib/types";
import { format } from "date-fns";

const CATEGORY_LABELS: Record<string, string> = {
  concerts: "Concerts",
  festivals: "Festivals",
  community: "Community",
  "severe-weather": "Weather Alerts",
  "public-holidays": "Holidays",
  "performing-arts": "Performing Arts",
  sports: "Sports",
};

const CATEGORY_ICONS: Record<string, string> = {
  concerts: "🎵",
  festivals: "🎪",
  community: "🏘️",
  "severe-weather": "⚠️",
  "public-holidays": "🗓️",
  "performing-arts": "🎭",
  sports: "🏟️",
};

export function LocalEventsSection({ events }: { events: LocalEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
        <h2 className="text-lg font-semibold text-amber flex items-center gap-2">
          <span className="text-xl">🌆</span> Around OKC
        </h2>
        <p className="text-muted mt-2 text-sm">No notable local events today.</p>
      </section>
    );
  }

  // Group by category
  const grouped = new Map<string, LocalEvent[]>();
  for (const event of events) {
    const cat = event.category || "community";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(event);
  }

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
      <h2 className="text-lg font-semibold text-amber flex items-center gap-2 mb-4">
        <span className="text-xl">🌆</span> Around OKC
        <span className="text-xs text-muted font-normal">
          ({events.length} event{events.length !== 1 ? "s" : ""} within 10mi)
        </span>
      </h2>

      {Array.from(grouped.entries()).map(([category, catEvents]) => (
        <div key={category} className="mb-4 last:mb-0">
          <h3 className="text-xs uppercase tracking-wider text-copper font-semibold mb-2 flex items-center gap-1.5">
            <span>{CATEGORY_ICONS[category] || "📌"}</span>
            {CATEGORY_LABELS[category] || category}
          </h3>
          <div className="grid gap-2">
            {catEvents.map((event) => {
              const time = event.start
                ? format(new Date(event.start), "h:mm a")
                : "";
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 bg-surface/50 rounded-lg px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {event.name}
                    </p>
                    {event.venue && (
                      <p className="text-xs text-muted">{event.venue}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {time && <p className="text-xs text-amber">{time}</p>}
                    {event.distance && (
                      <p className="text-[10px] text-muted">
                        {event.distance.toFixed(1)}mi
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
