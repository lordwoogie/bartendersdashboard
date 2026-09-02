"use client";

import { useState } from "react";
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
  type ColumnKey,
  type ProductionData,
  type ProductionItem,
  type ProductionWeek,
} from "@/lib/production";
import type { ActionResult } from "@/lib/use-production";
import { AddInline, TextEditor, btn } from "./shared";

// The week grid: one row per day (plus the "To Do" row for anything not
// pinned to a day), one column per area of the brewery — the same layout as
// the whiteboard/spreadsheet. On phones each day collapses into a card with
// only its non-empty columns.

type Act = (
  payload: Record<string, unknown>,
  optimistic?: (current: ProductionData) => ProductionData
) => Promise<ActionResult>;

interface Props {
  data: ProductionData;
  editing: boolean;
  act: Act;
  today: string;
  flash: (message: string) => void;
}

const GRID = "md:grid md:grid-cols-[6.5rem_repeat(6,minmax(0,1fr))] print:grid print:grid-cols-[5rem_repeat(6,minmax(0,1fr))]";

function patchWeek(
  data: ProductionData,
  weekStart: string,
  fn: (week: ProductionWeek) => ProductionWeek
): ProductionData {
  const existing = findWeek(data, weekStart) ?? emptyWeek(weekStart);
  const next = fn(existing);
  const weeks = data.weeks.filter((w) => w.weekStart !== weekStart).concat(next);
  weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return { ...data, weeks };
}

export function ScheduleTab({ data, editing, act, today, flash }: Props) {
  const thisMonday = mondayOf(today);
  const [weekStart, setWeekStart] = useState(thisMonday);
  const [showWeekend, setShowWeekend] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDay, setNoteDay] = useState<string | null>(null);
  // Phones show one day at a time (plus To Do) and open on today; "Week"
  // stacks all of them. Laptops always get the full grid.
  const [mobileDay, setMobileDay] = useState<string>(() =>
    weekDays(thisMonday).slice(0, 5).includes(today) ? today : "all"
  );

  const week = findWeek(data, weekStart) ?? emptyWeek(weekStart);
  const days = weekDays(weekStart);
  const weekendHasItems = week.items.some((i) => i.day === days[5] || i.day === days[6]);
  const visibleDays = days.slice(0, 5).concat(showWeekend || weekendHasItems ? days.slice(5) : []);
  const mobileShows = (day: string) =>
    mobileDay === "all" || day === TODO_DAY || day === mobileDay;

  const goToWeek = (next: string) => {
    setWeekStart(next);
    // Landing on this week opens today; any other week opens Monday.
    setMobileDay(mobileDay === "all" ? "all" : next === thisMonday ? today : next);
  };

  const tasks = week.items.filter((i) => isTaskColumn(i.column));
  const done = tasks.filter((i) => i.doneAt).length;

  // Nearest earlier week that has anything on it — the "copy last week"
  // source when this one is blank.
  const copySource = [...data.weeks]
    .filter((w) => w.weekStart < weekStart && w.items.length > 0)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];

  const relative =
    weekStart === thisMonday
      ? "This week"
      : weekStart === addDays(thisMonday, 7)
        ? "Next week"
        : weekStart === addDays(thisMonday, -7)
          ? "Last week"
          : weekStart.slice(0, 4);

  const itemsIn = (day: string, column: ColumnKey) =>
    week.items.filter((i) => i.day === day && i.column === column);

  const toggle = async (item: ProductionItem) => {
    const res = await act({ action: "toggle-item", weekStart, id: item.id }, (d) =>
      patchWeek(d, weekStart, (w) => ({
        ...w,
        items: w.items.map((i) =>
          i.id === item.id
            ? { ...i, doneAt: i.doneAt ? undefined : new Date().toISOString() }
            : i
        ),
      }))
    );
    if (!res.ok) flash(res.error);
  };

  const add = async (day: string, column: ColumnKey, text: string) => {
    const res = await act({ action: "add-item", weekStart, day, column, text });
    if (!res.ok) flash(res.error);
    return res.ok;
  };

  const ok = async (payload: Record<string, unknown>) => {
    const res = await act({ weekStart, ...payload });
    if (!res.ok) flash(res.error);
    return res.ok;
  };

  const renderItem = (item: ProductionItem) => {
    if (editingId === item.id) {
      return (
        <li key={item.id}>
          <TextEditor
            initial={item.text}
            onSave={(text) => ok({ action: "update-item", id: item.id, text })}
            onDelete={() => ok({ action: "remove-item", id: item.id })}
            onMove={(direction) => ok({ action: "move-item", id: item.id, direction })}
            onClose={() => setEditingId(null)}
          >
            <MoveTo
              item={item}
              days={visibleDays}
              onMove={async (day, column) => {
                const moved = await ok({ action: "move-item-to", id: item.id, day, column });
                if (moved) setEditingId(null);
                return moved;
              }}
            />
          </TextEditor>
        </li>
      );
    }
    if (editing) {
      return (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => setEditingId(item.id)}
            className="w-full text-left text-sm text-foreground bg-surface hover:border-amber/60 border border-card-border rounded-lg px-2.5 py-1.5 flex items-start gap-2"
          >
            <span className={`flex-1 ${item.doneAt ? "line-through text-muted" : ""}`}>{item.text}</span>
            <span aria-hidden="true" className="text-muted text-xs mt-0.5">✎</span>
          </button>
        </li>
      );
    }
    if (isTaskColumn(item.column)) {
      return (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => toggle(item)}
            aria-pressed={Boolean(item.doneAt)}
            className="w-full text-left flex items-start gap-2.5 md:gap-2 rounded-lg px-1.5 py-2.5 md:py-1.5 hover:bg-surface active:bg-surface"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 w-5 h-5 md:w-4 md:h-4 shrink-0 rounded border-2 flex items-center justify-center text-[11px] md:text-[10px] font-bold ${
                item.doneAt ? "bg-amber border-amber text-background" : "border-copper/60"
              }`}
            >
              {item.doneAt ? "✓" : ""}
            </span>
            <span className={`text-base md:text-sm leading-snug ${item.doneAt ? "line-through text-muted" : "text-foreground"}`}>
              {item.text}
            </span>
          </button>
        </li>
      );
    }
    return (
      <li key={item.id}>
        <span
          className={`inline-block text-sm rounded-md px-2 py-1 border ${
            item.column === "mia"
              ? "border-red-900/60 bg-red-950/40 text-red-300"
              : "border-amber/30 bg-amber/10 text-amber"
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
    return (
      <div
        key={day}
        className={`${mobileShows(day) ? "" : "hidden"} ${GRID} border-t border-card-border ${isToday ? "bg-amber/5" : ""}`}
      >
        <div
          className={`px-3 py-2 md:py-3 flex flex-wrap items-center gap-x-2 gap-y-1 md:block ${
            isTodo ? "bg-surface/60" : isToday ? "bg-amber/10" : "bg-surface/30"
          } md:bg-transparent`}
        >
          <div className={`text-sm font-bold uppercase tracking-wide ${isToday ? "text-amber" : "text-foreground"}`}>
            {isTodo ? "To Do" : dayLabel(day)}
          </div>
          {isTodo && <div className="text-[11px] text-muted">any day this week</div>}
          {isToday && <div className="text-[11px] text-amber font-medium">Today</div>}
          {note && (
            <div className="text-xs font-medium text-copper bg-copper/10 border border-copper/40 rounded px-1.5 py-0.5 md:mt-1 md:inline-block">
              {note}
            </div>
          )}
          {editing && !isTodo && noteDay !== day && (
            <button type="button" onClick={() => setNoteDay(day)} className={`${btn.ghost} no-print`}>
              {note ? "edit note" : "+ note"}
            </button>
          )}
          {noteDay === day && (
            <DayNoteEditor
              initial={note ?? ""}
              onSave={(text) => ok({ action: "set-day-note", day, note: text })}
              onClose={() => setNoteDay(null)}
            />
          )}
        </div>
        {ALL_COLUMNS.map((col) => {
          const items = itemsIn(day, col.key);
          const disabled = isTodo && !isTaskColumn(col.key);
          const hideOnMobile = items.length === 0 && (!editing || disabled);
          return (
            <div
              key={col.key}
              className={`${hideOnMobile ? "hidden md:block print:block" : ""} px-2.5 py-2 md:border-l md:border-card-border ${
                disabled ? "md:bg-surface/20" : ""
              }`}
            >
              <div className="md:hidden print:hidden text-[10px] uppercase tracking-wider text-muted mb-1">
                {col.label}
              </div>
              {items.length > 0 && <ul className="space-y-1">{items.map(renderItem)}</ul>}
              {editing && !disabled && (
                <div className={`no-print ${items.length > 0 ? "mt-1" : ""}`}>
                  <AddInline
                    compact
                    placeholder={col.key === "help" ? "e.g. Joey 9am" : col.key === "mia" ? "Who's out" : "Task"}
                    onAdd={(text) => add(day, col.key, text)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 no-print">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => goToWeek(addDays(weekStart, -7))}
          className={`${btn.secondary} px-3`}
        >
          ‹
        </button>
        <div className="flex-1 text-center min-w-0">
          <div className="font-semibold text-foreground text-lg leading-tight">{weekLabel(weekStart)}</div>
          <div className="text-xs text-muted">
            {relative}
            {tasks.length > 0 && ` · ${done}/${tasks.length} tasks done`}
          </div>
        </div>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => goToWeek(addDays(weekStart, 7))}
          className={`${btn.secondary} px-3`}
        >
          ›
        </button>
        {weekStart !== thisMonday && (
          <button type="button" onClick={() => goToWeek(thisMonday)} className={btn.secondary}>
            Today
          </button>
        )}
      </div>

      <div className="md:hidden flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5 no-print">
        {visibleDays.map((day) => {
          const count = week.items.filter((i) => i.day === day && isTaskColumn(i.column) && !i.doneAt).length;
          const active = mobileDay === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setMobileDay(day)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold leading-tight ${
                active
                  ? "border-amber bg-amber/15 text-amber"
                  : day === today
                    ? "border-amber/40 bg-surface text-amber"
                    : "border-card-border bg-surface text-foreground"
              }`}
            >
              {dayLabel(day).split(" ")[0]}
              <span className="block text-[10px] font-normal opacity-80">
                {dayLabel(day).split(" ")[1]}
                {count > 0 && ` · ${count}`}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileDay("all")}
          className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold ${
            mobileDay === "all"
              ? "border-amber bg-amber/15 text-amber"
              : "border-card-border bg-surface text-foreground"
          }`}
        >
          Week
        </button>
      </div>

      {editing && (
        <div className="flex flex-wrap items-center gap-3 text-sm no-print">
          {week.items.length === 0 && copySource && (
            <button
              type="button"
              onClick={async () => {
                const res = await act({ action: "copy-week", from: copySource.weekStart, to: weekStart });
                flash(res.ok ? `Copied ${weekLabel(copySource.weekStart)}` : res.error);
              }}
              className={btn.primary}
            >
              Copy {weekLabel(copySource.weekStart)} into this week
            </button>
          )}
          {!weekendHasItems && (
            <label className="flex items-center gap-2 text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={showWeekend}
                onChange={(e) => setShowWeekend(e.target.checked)}
                className="accent-amber"
              />
              Show Sat / Sun
            </label>
          )}
          <span className="text-xs text-muted">Tap any item to edit, reorder, or delete it.</span>
        </div>
      )}

      <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
        <div className={`hidden ${GRID} bg-surface text-[11px] uppercase tracking-wider text-muted font-semibold`}>
          <div className="px-3 py-2">Day</div>
          {ALL_COLUMNS.map((c) => (
            <div key={c.key} className="px-2.5 py-2 border-l border-card-border">
              {c.label}
            </div>
          ))}
        </div>
        {renderRow(TODO_DAY)}
        {visibleDays.map(renderRow)}
      </div>

      {week.items.length === 0 && !editing && (
        <p className="text-sm text-muted text-center">Nothing on the board for this week yet.</p>
      )}
    </div>
  );
}

function DayNoteEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (text: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await onSave(text.trim());
        setBusy(false);
        if (ok) onClose();
      }}
      className="flex gap-1 w-full mt-1 no-print"
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="e.g. Labor Day"
        className={`${btn.input} py-1 text-xs`}
      />
      <button type="submit" disabled={busy} className={`${btn.primary} py-1 px-2 text-xs`}>
        Save
      </button>
      <button type="button" onClick={onClose} className={`${btn.secondary} py-1 px-2 text-xs`}>
        ×
      </button>
    </form>
  );
}

// "Move to" inside an item's editor: pick a day and column, tap Move.
function MoveTo({
  item,
  days,
  onMove,
}: {
  item: ProductionItem;
  days: string[];
  onMove: (day: string, column: ColumnKey) => Promise<boolean>;
}) {
  const [day, setDay] = useState(item.day);
  const [column, setColumn] = useState<ColumnKey>(item.column);
  const [busy, setBusy] = useState(false);
  const unchanged = day === item.day && column === item.column;
  const invalid = day === TODO_DAY && !isTaskColumn(column);
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="text-muted mr-1">Move to</span>
      <select value={day} onChange={(e) => setDay(e.target.value)} className={`${btn.input} w-auto py-1 text-xs`}>
        <option value={TODO_DAY}>To Do</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {dayLabel(d)}
          </option>
        ))}
      </select>
      <select
        value={column}
        onChange={(e) => setColumn(e.target.value as ColumnKey)}
        className={`${btn.input} w-auto py-1 text-xs`}
      >
        {ALL_COLUMNS.map((c) => (
          <option key={c.key} value={c.key} disabled={day === TODO_DAY && !isTaskColumn(c.key)}>
            {c.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy || unchanged || invalid}
        onClick={async () => {
          setBusy(true);
          await onMove(day, column);
          setBusy(false);
        }}
        className={`${btn.secondary} py-1 px-3 text-xs`}
      >
        Move
      </button>
    </div>
  );
}
