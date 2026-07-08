"use client";

import { useState, useEffect, useCallback } from "react";
import bookData from "@/data/the-book.json";
import { BackToDashboard } from "@/components/BackToDashboard";
import { formatTimeInZone, formatDateLabel } from "@/lib/timezone";

interface BookLogEntry {
  date: string;
  day: string;
  completedAt: string;
  itemCount: number;
}

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAY_LABELS: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

const DAY_FULL_LABELS: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

type DayKey = (typeof DAYS)[number];
type DayData = {
  specialTask: string;
  opening: string[];
  beforeClockout: string[];
  specialClosingTask: string;
  closing: string[];
  closingMoney: string[];
};

// YYYY-MM-DD in the browser's local timezone — the tablet lives at the venue,
// so local date is the right day boundary.
function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Storage key is scoped to date + day tab so:
//  - progress persists across close/refresh/navigate,
//  - a new day naturally starts fresh (no manual reset needed),
//  - previewing another day's tab doesn't clobber today's checks.
function storageKey(day: DayKey): string {
  return `book-checks:${todayLocalIso()}:${day}`;
}

export function BookPage() {
  const [selectedDay, setSelectedDay] = useState<DayKey>("monday");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Pick today's tab on first render.
  useEffect(() => {
    const today = DAYS[new Date().getDay()];
    setSelectedDay(today);
  }, []);

  // Hydrate/reload checks whenever the selected day changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey(selectedDay));
      setCheckedItems(raw ? JSON.parse(raw) : {});
    } catch {
      setCheckedItems({});
    }
  }, [selectedDay]);

  const dayData = (bookData as Record<string, DayData>)[selectedDay];
  const isToday = DAYS[new Date().getDay()] === selectedDay;

  // Completion log: fetched for the history section, appended to when the
  // last box of today's list gets checked.
  const [logEntries, setLogEntries] = useState<BookLogEntry[]>([]);
  const refreshLog = useCallback(async () => {
    try {
      const res = await fetch("/api/book-log?limit=30");
      const data = await res.json();
      setLogEntries(data.entries || []);
    } catch {
      // non-fatal; section just stays empty
    }
  }, []);
  useEffect(() => {
    refreshLog();
  }, [refreshLog]);

  // Every checkable key for the selected day, in section order.
  const allKeys = [
    "special-opening",
    ...dayData.opening.map((_, i) => `open-${i}`),
    ...dayData.beforeClockout.map((_, i) => `clockout-${i}`),
    "special-closing",
    ...dayData.closing.map((_, i) => `close-${i}`),
    ...dayData.closingMoney.map((_, i) => `money-${i}`),
  ];

  const todayComplete =
    isToday && logEntries.some((e) => e.date === todayLocalIso());

  const toggleCheck = (key: string) => {
    setCheckedItems((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(storageKey(selectedDay), JSON.stringify(next));
      } catch {
        // storage full or disabled — state still updates in memory
      }

      // The moment the whole day is checked off (and it IS today, not a
      // preview of another day), record the completion. The server upserts
      // by date, so re-fires after an uncheck/recheck are harmless.
      if (isToday && allKeys.every((k) => next[k])) {
        fetch("/api/book-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: todayLocalIso(),
            day: selectedDay,
            itemCount: allKeys.length,
          }),
        })
          .then(() => refreshLog())
          .catch(() => {});
      }

      return next;
    });
  };

  const resetChecks = () => {
    setCheckedItems({});
    try {
      window.localStorage.removeItem(storageKey(selectedDay));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-card-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <BackToDashboard />
          <h1 className="text-xl font-bold tracking-wide text-amber-500 uppercase">
            The Book
          </h1>
          <button
            onClick={resetChecks}
            className="text-xs text-amber-500/60 hover:text-amber-500 border border-amber-500/30 rounded px-2 py-1 transition-colors"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Day Tabs */}
      <div className="sticky top-[57px] z-40 border-b border-card-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {DAYS.map((day) => {
              const active = day === selectedDay;
              const today = DAYS[new Date().getDay()] === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`
                    flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${
                      active
                        ? "bg-amber-500 text-black"
                        : "text-foreground/60 hover:text-foreground hover:bg-card-bg"
                    }
                    ${today && !active ? "ring-1 ring-amber-500/50" : ""}
                  `}
                >
                  {DAY_LABELS[day]}
                  {today && (
                    <span className="ml-1 text-[10px] opacity-70">*</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6 pb-24">
        {/* Day Title */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amber-500">
            {DAY_FULL_LABELS[selectedDay]}
          </h2>
          {isToday && (
            <p className="text-xs text-amber-500/60 mt-1 uppercase tracking-widest">
              Today
            </p>
          )}
        </div>

        {/* Opening Special Task */}
        <Section title="Opening Special Task" icon="&#9733;">
          <SpecialBox
            text={dayData.specialTask}
            checkKey="special-opening"
            checked={!!checkedItems["special-opening"]}
            onToggle={toggleCheck}
          />
        </Section>

        {/* Opening Duties */}
        <Section title="Opening Duties" icon="&#9788;">
          <Checklist
            items={dayData.opening}
            prefix="open"
            checked={checkedItems}
            onToggle={toggleCheck}
          />
        </Section>

        {/* Before Clock-out */}
        <Section title="Before Clock-out" icon="&#9201;">
          <Checklist
            items={dayData.beforeClockout}
            prefix="clockout"
            checked={checkedItems}
            onToggle={toggleCheck}
          />
        </Section>

        {/* Closing Special Task */}
        <Section title="Closing Special Task" icon="&#9733;">
          <SpecialBox
            text={dayData.specialClosingTask}
            variant="closing"
            checkKey="special-closing"
            checked={!!checkedItems["special-closing"]}
            onToggle={toggleCheck}
          />
        </Section>

        {/* Closing Duties */}
        <Section title="Closing Duties" icon="&#9790;">
          <Checklist
            items={dayData.closing}
            prefix="close"
            checked={checkedItems}
            onToggle={toggleCheck}
          />
        </Section>

        {/* Cash Out */}
        <Section title="Cash Out" icon="$">
          <Checklist
            items={dayData.closingMoney}
            prefix="money"
            checked={checkedItems}
            onToggle={toggleCheck}
          />
        </Section>

        {/* Today-complete banner */}
        {todayComplete && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-center">
            <p className="text-amber-400 font-semibold">
              ✅ Book complete — logged for today
            </p>
          </div>
        )}

        {/* Completion Log */}
        <Section title="Completion Log" icon="&#128203;">
          {logEntries.length === 0 ? (
            <p className="text-sm text-foreground/50">
              No completions logged yet. The log records the day and time the
              last box gets checked.
            </p>
          ) : (
            <div className="space-y-1.5">
              {logEntries.map((e) => (
                <div
                  key={e.date}
                  className="flex items-center justify-between rounded-lg bg-card-bg border border-card-border px-3 py-2 text-sm"
                >
                  <span className="text-foreground/90">
                    ✅ {formatDateLabel(e.date, "short")}
                  </span>
                  <span className="text-xs text-foreground/50">
                    finished {formatTimeInZone(new Date(e.completedAt))} ·{" "}
                    {e.itemCount} tasks
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-amber-500 text-lg">{icon}</span>
        <h3 className="text-lg font-semibold text-amber-400 uppercase tracking-wider">
          {title}
        </h3>
        <div className="flex-1 border-t border-card-border ml-2" />
      </div>
      {children}
    </section>
  );
}

function SpecialBox({
  text,
  variant = "opening",
  checkKey,
  checked,
  onToggle,
}: {
  text: string;
  variant?: "opening" | "closing";
  checkKey: string;
  checked: boolean;
  onToggle: (key: string) => void;
}) {
  const borderColor =
    variant === "opening" ? "border-amber-500/40" : "border-orange-600/40";
  const bgColor =
    variant === "opening" ? "bg-amber-500/10" : "bg-orange-600/10";
  const accentColor =
    variant === "opening" ? "text-amber-400" : "text-orange-400";
  const accentBorder =
    variant === "opening" ? "border-amber-500" : "border-orange-600";
  const accentFill =
    variant === "opening" ? "bg-amber-500" : "bg-orange-600";

  return (
    <button
      type="button"
      onClick={() => onToggle(checkKey)}
      aria-pressed={checked}
      className={`w-full text-left rounded-lg border ${borderColor} ${bgColor} p-4 relative overflow-hidden flex items-start gap-3 transition-opacity ${
        checked ? "opacity-50" : "hover:brightness-110"
      }`}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${accentFill}`}
        aria-hidden="true"
      />
      <div
        className={`flex-shrink-0 w-5 h-5 rounded border-2 mt-0.5 flex items-center justify-center transition-colors ${
          checked ? `${accentFill} ${accentBorder}` : `${accentBorder}/60`
        }`}
      >
        {checked && (
          <svg
            className="w-3 h-3 text-black"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </div>
      <p
        className={`${accentColor} text-sm leading-relaxed pl-1 ${
          checked ? "line-through" : ""
        }`}
      >
        {text}
      </p>
    </button>
  );
}

function Checklist({
  items,
  prefix,
  checked,
  onToggle,
}: {
  items: string[];
  prefix: string;
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const completedCount = items.filter(
    (_, i) => checked[`${prefix}-${i}`]
  ).length;
  const total = items.length;

  return (
    <div className="space-y-1">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-card-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${total > 0 ? (completedCount / total) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-foreground/50 tabular-nums">
          {completedCount}/{total}
        </span>
      </div>

      {items.map((item, i) => {
        const key = `${prefix}-${i}`;
        const isChecked = !!checked[key];
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={`
              w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all
              ${
                isChecked
                  ? "bg-card-bg/50 opacity-50"
                  : "bg-card-bg hover:bg-card-bg/80"
              }
              border border-card-border
            `}
          >
            <div
              className={`
              flex-shrink-0 w-5 h-5 rounded border-2 mt-0.5 flex items-center justify-center transition-colors
              ${
                isChecked
                  ? "bg-amber-500 border-amber-500"
                  : "border-amber-500/40"
              }
            `}
            >
              {isChecked && (
                <svg
                  className="w-3 h-3 text-black"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <span
              className={`text-sm leading-relaxed ${
                isChecked ? "line-through text-foreground/40" : "text-foreground/90"
              }`}
            >
              {item}
            </span>
          </button>
        );
      })}
    </div>
  );
}
