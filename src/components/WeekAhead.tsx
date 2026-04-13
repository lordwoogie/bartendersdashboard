"use client";

import { useState } from "react";
import type { SportsGame, CalendarEvent, LocalEvent } from "@/lib/types";
import { format, addDays, isSameDay } from "date-fns";

interface WeekAheadProps {
  games: SportsGame[];
  calendarEvents: CalendarEvent[];
  localEvents: LocalEvent[];
}

export function WeekAhead({ games, calendarEvents, localEvents }: WeekAheadProps) {
  const [expanded, setExpanded] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold text-amber flex items-center gap-2">
          <span className="text-xl">📅</span> This Week Ahead
        </h2>
        <span className="text-muted text-xl transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>
          ▾
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {days.map((day) => {
            const dayGames = games.filter((g) => isSameDay(new Date(g.time), day));
            const dayCalendar = calendarEvents.filter((e) =>
              isSameDay(new Date(e.start), day)
            );
            const dayLocal = localEvents.filter((e) =>
              isSameDay(new Date(e.start), day)
            );
            const isEmpty =
              dayGames.length === 0 && dayCalendar.length === 0 && dayLocal.length === 0;

            return (
              <div key={day.toISOString()} className="border-l-2 border-copper/30 pl-4">
                <h3 className="text-sm font-semibold text-copper mb-1">
                  {format(day, "EEEE, MMM d")}
                  {isSameDay(day, new Date()) && (
                    <span className="ml-2 text-xs bg-amber/20 text-amber px-1.5 py-0.5 rounded">
                      Today
                    </span>
                  )}
                </h3>

                {isEmpty ? (
                  <p className="text-xs text-muted">Nothing scheduled</p>
                ) : (
                  <div className="space-y-1">
                    {dayGames
                      .filter((g) => g.isThunder)
                      .map((g) => (
                        <p key={g.id} className="text-xs text-thunder-blue">
                          ⚡ Thunder vs {g.awayTeam === "Oklahoma City Thunder" ? g.homeTeam : g.awayTeam} &middot;{" "}
                          {format(new Date(g.time), "h:mm a")}
                        </p>
                      ))}
                    {dayCalendar.map((e) => (
                      <p key={e.id} className="text-xs text-foreground">
                        🤠 {e.summary} &middot;{" "}
                        {format(new Date(e.start), "h:mm a")}
                      </p>
                    ))}
                    {dayGames
                      .filter((g) => !g.isThunder && g.isFavorite)
                      .map((g) => (
                        <p key={g.id} className="text-xs text-amber">
                          📺 {g.awayTeam} @ {g.homeTeam} &middot;{" "}
                          {format(new Date(g.time), "h:mm a")}
                        </p>
                      ))}
                    {dayLocal.slice(0, 3).map((e) => (
                      <p key={e.id} className="text-xs text-muted">
                        📌 {e.name}
                        {e.venue ? ` @ ${e.venue}` : ""}
                      </p>
                    ))}
                    {dayLocal.length > 3 && (
                      <p className="text-[10px] text-muted">
                        +{dayLocal.length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
