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

  const week = findWeek(data, weekStart) ?? emptyWeek(weekStart);
  const days = weekDays(weekStart);
  const weekendHasItems = week.items.some((i) => i.day === days[5] || i.day === days[6]);
  const visibleDays = days.slice(0, 5).concat(showWeekend || weekendHasItems ? days.slice(5) : []);

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
          />
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
            className="w-full text-left flex items-start gap-2 rounded-lg px-1.5 py-1.5 hover:bg-surface"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-[10px] font-bold ${
                item.doneAt ? "bg-amber border-amber text-background" : "border-copper/60"
              }`}
            >
              {item.doneAt ? "✓" : ""}
            </span>
            <span className={`text-sm leading-snug ${item.doneAt ? "line-through text-muted" : "text-foreground"}`}>
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
        className={`${GRID} border-t border-card-border ${isToday ? "bg-amber/5" : ""}`}
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
          onClick={() => setWeekStart(addDays(weekStart, -7))}
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
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className={`${btn.secondary} px-3`}
        >
          ›
        </button>
        {weekStart !== thisMonday && (
          <button type="button" onClick={() => setWeekStart(thisMonday)} className={btn.secondary}>
            Today
          </button>
        )}
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
