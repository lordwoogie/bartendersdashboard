"use client";

import { useState, useEffect, useCallback } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";

interface Shift {
  id: number;
  employee: string;
  area: string;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  published: boolean;
}

interface Memo {
  id: number;
  content: string;
  creator: string;
  created: string;
}

const AREA_COLORS: Record<string, string> = {
  manager: "bg-amber/20 text-amber",
  "bar shift": "bg-copper/20 text-copper",
  kitchen: "bg-green-900/30 text-green-400",
  door: "bg-blue-900/30 text-blue-400",
};

function getAreaColor(area: string): string {
  return AREA_COLORS[area.toLowerCase()] || "bg-surface text-muted";
}

function formatDayLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE, MMM d");
}

export function SchedulePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [latestPost, setLatestPost] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule?days=7");
      const data = await res.json();
      if (data.shifts) setShifts(data.shifts);
      if (data.latestPost) setLatestPost(data.latestPost);
      if (data.error) setError(data.error);
    } catch {
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Group shifts by date
  const shiftsByDate = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const dateKey = shift.date.split("T")[0];
    if (!shiftsByDate.has(dateKey)) shiftsByDate.set(dateKey, []);
    shiftsByDate.get(dateKey)!.push(shift);
  }

  // Sort each day's shifts by start time
  for (const [, dayShifts] of shiftsByDate) {
    dayShifts.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Staff Schedule
            </h1>
            <p className="text-sm text-muted mt-0.5">
              {shifts.length} shifts this week
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
              onClick={fetchSchedule}
              disabled={loading}
              className="text-xs bg-surface hover:bg-card-border text-foreground px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading && shifts.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">📋</div>
              <p className="text-muted">Loading schedule...</p>
            </div>
          </div>
        ) : error && shifts.length === 0 ? (
          <div className="rounded-xl border border-card-border bg-card-bg p-6 text-center">
            <p className="text-muted">{error}</p>
          </div>
        ) : (
          <div>
            {latestPost && (
              <div className="rounded-xl border border-amber/30 bg-gradient-to-r from-amber/10 to-surface mb-6 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">📢</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-amber uppercase tracking-wider">
                        Latest Post
                      </span>
                      <span className="text-[10px] text-muted">
                        {format(new Date(latestPost.created), "MMM d")} by {latestPost.creator}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                      {latestPost.content}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {Array.from(shiftsByDate.entries()).map(([dateKey, dayShifts]) => (
            <div key={dateKey} className="mb-6">
              <h2 className="text-sm font-semibold text-copper mb-3 flex items-center gap-2">
                <span className="text-base">📅</span>
                {formatDayLabel(dateKey)}
                <span className="text-xs text-muted font-normal">
                  ({dayShifts.length} shift
                  {dayShifts.length !== 1 ? "s" : ""})
                </span>
              </h2>

              <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                {dayShifts.map((shift, i) => {
                  const start = format(
                    new Date(shift.startTime),
                    "h:mm a"
                  );
                  const end = format(new Date(shift.endTime), "h:mm a");

                  return (
                    <div
                      key={shift.id}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        i !== dayShifts.length - 1
                          ? "border-b border-card-border/50"
                          : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          {shift.employee}
                        </p>
                        <span
                          className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider mt-0.5 ${getAreaColor(
                            shift.area
                          )}`}
                        >
                          {shift.area}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm text-amber font-medium">
                          {start} – {end}
                        </p>
                        <p className="text-[10px] text-muted">
                          {shift.totalHours}h
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
        )}
      </main>
    </div>
  );
}
