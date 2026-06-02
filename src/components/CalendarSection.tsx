"use client";

import { useState } from "react";
import type { CalendarEvent } from "@/lib/types";
import { format, isToday, isTomorrow } from "date-fns";

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

export function CalendarSection({ events }: { events: CalendarEvent[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (events.length === 0) {
    return (
      <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
        <h2 className="text-lg font-semibold text-amber flex items-center gap-2">
          <span className="text-xl">🤠</span> Our Events
        </h2>
        <p className="text-muted mt-2 text-sm">Nothing scheduled this week. Quiet shift ahead.</p>
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
          const startDate = new Date(event.start);
          const dayLabel = formatEventDate(event.start);
          const startTime = format(startDate, "h:mm a");
          const endTime = event.end ? format(new Date(event.end), "h:mm a") : null;
          const hasDetails = Boolean(event.description || event.location);
          const isOpen = expanded.has(event.id);

          return (
            <div
              key={event.id}
              className="rounded-lg bg-gradient-to-r from-surface to-surface/60 border border-copper/30 p-4"
            >
              <button
                type="button"
                onClick={() => hasDetails && toggle(event.id)}
                aria-expanded={hasDetails ? isOpen : undefined}
                className={`w-full text-left flex items-start justify-between gap-3 ${
                  hasDetails ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-copper/20 text-copper px-1.5 py-0.5 rounded font-medium">
                      {dayLabel}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground mt-1 flex items-center gap-1.5">
                    {event.summary}
                    {hasDetails && (
                      <span
                        className={`text-copper text-xs transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                    )}
                  </h3>
                  {hasDetails && !isOpen && (
                    <p className="text-xs text-muted/70 mt-1">Tap for details</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-amber">{startTime}</p>
                  {endTime && (
                    <p className="text-xs text-muted">to {endTime}</p>
                  )}
                </div>
              </button>

              {hasDetails && isOpen && (
                <div className="mt-3 pt-3 border-t border-copper/20">
                  {event.description && (
                    <p className="text-sm text-muted/80 whitespace-pre-line leading-relaxed">
                      {event.description}
                    </p>
                  )}
                  {event.location && (
                    <p className="text-xs text-copper mt-1.5 flex items-center gap-1">
                      📍 {event.location}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
