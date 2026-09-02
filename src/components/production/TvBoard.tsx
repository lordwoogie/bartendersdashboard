"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ALL_COLUMNS,
  TODO_DAY,
  addDays,
  dayLabel,
  emptyWeek,
  findWeek,
  isTaskColumn,
  mondayOf,
  weekDays,
  weekLabel,
  type ProductionData,
  type ProductionItem,
} from "@/lib/production";
import { dateKeyInZone, formatTimeInZone } from "@/lib/timezone";

// /production/tv — the week board for a wall TV. No header, no buttons, big
// type, and the whole grid scaled to fit the screen so nothing needs
// scrolling. Reloads itself every minute and rolls to the new week on Monday.
//
// Settings live in the URL so a bookmark on the TV keeps them:
//   ?week=next      show next week instead of this one
//   ?from=today     hide days that are already over
//   ?done=hide      hide checked-off tasks instead of striking them through
// A control bar appears on mouse move / tap and hides again after a moment.

const REFRESH_MS = 60_000;
// A light week (a couple of items) gets scaled up so it still fills the TV;
// beyond this the type gets silly.
const MAX_SCALE = 1.6;
const GRID = "grid grid-cols-[9rem_repeat(6,minmax(0,1fr))]";

export function TvBoard() {
  const params = useSearchParams();
  const showNext = params.get("week") === "next";
  const fromToday = params.get("from") === "today";
  const hideDone = params.get("done") === "hide";

  const [data, setData] = useState<ProductionData | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [controls, setControls] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/production", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error || "load failed");
      setData(json.data);
      setUpdatedAt(new Date());
      setError("");
    } catch {
      // Keep showing the last good board; just flag that it may be stale.
      setError("Couldn't refresh — showing the last copy");
    }
  }, []);

  // Clock + refresh timers. The clock tick also moves the "today" highlight
  // at midnight and rolls the board to the new week on Monday morning.
  useEffect(() => {
    setNow(new Date());
    load();
    const clock = window.setInterval(() => setNow(new Date()), 30_000);
    const refresh = window.setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Show the control bar briefly on any pointer activity.
  useEffect(() => {
    let timer: number | undefined;
    const wake = () => {
      setControls(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setControls(false), 4000);
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("keydown", wake);
      window.clearTimeout(timer);
    };
  }, []);

  // Fit-to-screen: lay the board out at full width, measure, and scale it
  // (down for a packed week, up for a light one) until it fits the height. Widening the board as it shrinks keeps
  // text from wrapping more than it has to, so a few passes converge on the
  // largest type that fits.
  const outerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fit = useCallback(() => {
    const outer = outerRef.current;
    const board = boardRef.current;
    if (!outer || !board) return;
    const availW = outer.clientWidth;
    const availH = outer.clientHeight;
    if (!availW || !availH) return;
    let scale = 1;
    board.style.transform = "";
    board.style.width = `${availW}px`;
    for (let i = 0; i < 5; i++) {
      const h = board.offsetHeight;
      const next = Math.min(MAX_SCALE, availH / h);
      if (Math.abs(next - scale) < 0.005) {
        scale = next;
        break;
      }
      scale = next;
      board.style.width = `${availW / scale}px`;
    }
    // Final guard: never let the last width change push it past the bottom.
    const h = board.offsetHeight;
    if (h * scale > availH) scale = availH / h;
    board.style.transformOrigin = "top left";
    board.style.transform = `scale(${scale})`;
  }, []);

  const today = now ? dateKeyInZone(now) : null;
  const weekStart = today ? addDays(mondayOf(today), showNext ? 7 : 0) : null;

  useLayoutEffect(() => {
    fit();
  }, [fit, data, weekStart, today, fromToday, hideDone]);

  useEffect(() => {
    window.addEventListener("resize", fit);
    const ro = outerRef.current ? new ResizeObserver(fit) : null;
    if (outerRef.current && ro) ro.observe(outerRef.current);
    // Fonts finishing loading changes wrap points; refit once they're in.
    document.fonts?.ready.then(fit).catch(() => {});
    return () => {
      window.removeEventListener("resize", fit);
      ro?.disconnect();
    };
  }, [fit]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (value === null) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    window.location.assign(`${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  if (!data || !today || !weekStart || !now) {
    return (
      <div className="h-screen w-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🍺</div>
          <p className="text-2xl text-muted">{error || "Loading the board…"}</p>
        </div>
      </div>
    );
  }

  const week = findWeek(data, weekStart) ?? emptyWeek(weekStart);
  const days = weekDays(weekStart);
  const weekendHasItems = week.items.some((i) => i.day === days[5] || i.day === days[6]);
  let visibleDays = weekendHasItems ? days : days.slice(0, 5);
  if (fromToday && !showNext) {
    const remaining = visibleDays.filter((d) => d >= today);
    // Past the last listed day (e.g. Saturday): keep the whole week rather
    // than showing an empty screen.
    if (remaining.length > 0) visibleDays = remaining;
  }

  const itemsIn = (day: string, column: string) =>
    week.items.filter((i) => i.day === day && i.column === column && !(hideDone && i.doneAt));

  const tasks = week.items.filter((i) => isTaskColumn(i.column));
  const done = tasks.filter((i) => i.doneAt).length;

  const renderItem = (item: ProductionItem) => {
    if (isTaskColumn(item.column)) {
      return (
        <li key={item.id} className="flex items-start gap-2 leading-snug">
          <span
            aria-hidden="true"
            className={`mt-1 w-[1.1em] h-[1.1em] shrink-0 rounded border-2 flex items-center justify-center text-[0.7em] font-bold ${
              item.doneAt ? "bg-amber border-amber text-background" : "border-copper/70"
            }`}
          >
            {item.doneAt ? "✓" : ""}
          </span>
          <span className={item.doneAt ? "line-through text-muted" : "text-foreground"}>{item.text}</span>
        </li>
      );
    }
    return (
      <li key={item.id}>
        <span
          className={`inline-block rounded-md px-2 py-0.5 border leading-snug ${
            item.column === "mia"
              ? "border-red-900/70 bg-red-950/50 text-red-300"
              : "border-amber/40 bg-amber/10 text-amber"
          }`}
        >
          {item.text}
        </span>
      </li>
    );
  };

  const renderRow = (day: string) => {
    const isTodo = day === TODO_DAY;
    const isToday = day === today;
    const note = !isTodo ? week.dayNotes?.[day] : undefined;
    const empty = ALL_COLUMNS.every((c) => itemsIn(day, c.key).length === 0);
    if (isTodo && empty) return null;
    return (
      <div
        key={day}
        className={`${GRID} border-t-2 border-card-border ${isToday ? "bg-amber/10" : isTodo ? "bg-surface/50" : ""}`}
      >
        <div className={`px-4 py-3 ${isToday ? "border-l-8 border-amber" : "border-l-8 border-transparent"}`}>
          <div className={`text-[1.6em] font-extrabold uppercase tracking-wide leading-none ${isToday ? "text-amber" : "text-foreground"}`}>
            {isTodo ? "To Do" : dayLabel(day)}
          </div>
          {isTodo && <div className="text-[0.85em] text-muted mt-1">any day this week</div>}
          {isToday && <div className="text-[0.85em] text-amber font-semibold mt-1">Today</div>}
          {note && (
            <div className="mt-2 inline-block text-[0.9em] font-semibold text-copper bg-copper/10 border border-copper/50 rounded px-2 py-0.5">
              {note}
            </div>
          )}
        </div>
        {ALL_COLUMNS.map((col) => {
          const items = itemsIn(day, col.key);
          const disabled = isTodo && !isTaskColumn(col.key);
          return (
            <div
              key={col.key}
              className={`px-3 py-3 border-l border-card-border ${disabled ? "bg-surface/30" : ""}`}
            >
              {items.length > 0 && <ul className="space-y-1.5">{items.map(renderItem)}</ul>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col select-none">
      <header className="flex items-end justify-between px-6 pt-4 pb-3 shrink-0">
        <div>
          <div className="text-sm uppercase tracking-[0.3em] text-copper font-semibold">Lively Production</div>
          <h1 className="text-4xl font-extrabold text-amber leading-tight">
            {weekLabel(weekStart)}
            <span className="ml-3 text-2xl font-semibold text-muted">
              {showNext ? "Next week" : "This week"}
            </span>
          </h1>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold tabular-nums leading-tight">{formatTimeInZone(now)}</div>
          <div className="text-sm text-muted">
            {tasks.length > 0 && `${done}/${tasks.length} tasks done · `}
            {error ? <span className="text-red-300">{error}</span> : updatedAt ? `Updated ${formatTimeInZone(updatedAt)}` : ""}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 px-6 pb-4">
        <div ref={outerRef} className="h-full w-full overflow-hidden">
        <div ref={boardRef} className="text-[1.35rem] bg-card-bg border-2 border-card-border rounded-2xl overflow-hidden">
          <div className={`${GRID} bg-surface text-[0.8em] uppercase tracking-wider text-muted font-bold`}>
            <div className="px-4 py-2 border-l-8 border-transparent">Day</div>
            {ALL_COLUMNS.map((c) => (
              <div key={c.key} className="px-3 py-2 border-l border-card-border">
                {c.label}
              </div>
            ))}
          </div>
          {renderRow(TODO_DAY)}
          {visibleDays.map(renderRow)}
          {week.items.length === 0 && (
            <div className="px-6 py-16 text-center text-muted text-[1.2em] border-t-2 border-card-border">
              Nothing on the board for {weekLabel(weekStart)} yet.
            </div>
          )}
        </div>
        </div>
      </div>

      <div
        className={`fixed bottom-0 inset-x-0 flex flex-wrap items-center justify-center gap-2 p-3 bg-background/90 backdrop-blur border-t border-card-border transition-opacity duration-300 ${
          controls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <a href="/production" className={chip(false)}>
          ← Board
        </a>
        <span className="w-px h-6 bg-card-border mx-1" />
        <button type="button" onClick={() => setParam("week", null)} className={chip(!showNext)}>
          This week
        </button>
        <button type="button" onClick={() => setParam("week", "next")} className={chip(showNext)}>
          Next week
        </button>
        <span className="w-px h-6 bg-card-border mx-1" />
        <button type="button" onClick={() => setParam("from", null)} className={chip(!fromToday)}>
          Whole week
        </button>
        <button type="button" onClick={() => setParam("from", "today")} className={chip(fromToday)}>
          From today
        </button>
        <span className="w-px h-6 bg-card-border mx-1" />
        <button type="button" onClick={() => setParam("done", null)} className={chip(!hideDone)}>
          Strike done
        </button>
        <button type="button" onClick={() => setParam("done", "hide")} className={chip(hideDone)}>
          Hide done
        </button>
        <span className="w-px h-6 bg-card-border mx-1" />
        <button type="button" onClick={toggleFullscreen} className={chip(false)}>
          ⛶ Fullscreen
        </button>
      </div>
    </div>
  );
}

function chip(active: boolean) {
  return `rounded-lg border px-3 py-1.5 text-sm font-medium ${
    active
      ? "border-amber bg-amber/15 text-amber"
      : "border-card-border bg-surface text-foreground hover:border-amber hover:text-amber"
  }`;
}
