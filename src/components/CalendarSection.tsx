"use client";

import type { CalendarEvent } from "@/lib/types";
import { format } from "date-fns";

export function CalendarSection({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
        <h2 className="text-lg font-semibold text-amber flex items-center gap-2">
          <span className="text-xl">🤠</span> Our Events
        </h2>
        <p className="text-muted mt-2 text-sm">Nothing scheduled today. Quiet shift ahead.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
      <h2 className="text-lg font-semibold text-amber flex items-center gap-2 mb-4">
        <span className="text-xl">🤠</span> Our Events
      </h2>

      <div className="grid gap-3">
        {events.map((event) => {
          const startTime = format(new Date(event.start), "h:mm a");
          const endTime = event.end ? format(new Date(event.end), "h:mm a") : null;

          return (
            <div
              key={event.id}
              className="rounded-lg bg-gradient-to-r from-surface to-surface/60 border border-copper/30 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{event.summary}</h3>
                  {event.description && (
                    <p className="text-sm text-muted mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                  {event.location && (
                    <p className="text-xs text-copper mt-1">{event.location}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-amber">{startTime}</p>
                  {endTime && (
                    <p className="text-xs text-muted">to {endTime}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
