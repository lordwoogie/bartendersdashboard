"use client";

import { useMemo, useState } from "react";
import { longDate, shortDate, type CrowderEntry, type ProductionData, type RunLogEntry } from "@/lib/production";
import type { ActionResult } from "@/lib/use-production";
import { Card, btn } from "./shared";

// The two log sheets: "Crowder Inventory" (packaging materials bought, and
// whether they've been reimbursed) and the canning run history.

type Act = (payload: Record<string, unknown>) => Promise<ActionResult>;

interface Props {
  data: ProductionData;
  editing: boolean;
  act: Act;
  flash: (message: string) => void;
  today: string;
}

export function LogsTab({ data, editing, act, flash, today }: Props) {
  const ok = async (payload: Record<string, unknown>) => {
    const res = await act(payload);
    if (!res.ok) flash(res.error);
    return res.ok;
  };
  return (
    <div className="space-y-4">
      <CrowderLog entries={data.crowder} editing={editing} ok={ok} today={today} />
      <RunLog entries={data.runLog} editing={editing} ok={ok} today={today} />
    </div>
  );
}

type Ok = (payload: Record<string, unknown>) => Promise<boolean>;

// ---- Crowder inventory ---------------------------------------------------

function CrowderLog({
  entries,
  editing,
  ok,
  today,
}: {
  entries: CrowderEntry[];
  editing: boolean;
  ok: Ok;
  today: string;
}) {
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () =>
      [...entries]
        .filter((e) => !onlyOpen || !e.reimbursed)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries, onlyOpen]
  );
  const openCount = entries.filter((e) => !e.reimbursed).length;

  return (
    <Card
      title="Crowder Inventory"
      subtitle={`${openCount} not yet reimbursed`}
      action={
        <label className="flex items-center gap-2 text-xs text-slate cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
            className="accent-green"
          />
          Only unpaid
        </label>
      }
    >
      {editing && (
        <div className="mb-3">
          {adding ? (
            <CrowderForm
              initial={{ id: "", date: today, item: "", reimbursed: false }}
              onSave={(fields) => ok({ action: "add-crowder", ...fields })}
              onClose={() => setAdding(false)}
            />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className={btn.primary}>
              + Add entry
            </button>
          )}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-slate">Nothing logged.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[32rem]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate text-left">
                <th className="px-4 sm:px-2 py-2 font-bold">Date</th>
                <th className="px-2 py-2 font-bold">Item / #</th>
                <th className="px-2 py-2 font-bold">Reimbursed</th>
                <th className="px-2 py-2 font-bold">Notes</th>
                {editing && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-line">
              {rows.map((e) =>
                editingId === e.id ? (
                  <tr key={e.id}>
                    <td colSpan={editing ? 5 : 4} className="px-4 sm:px-2 py-2">
                      <CrowderForm
                        initial={e}
                        onSave={(fields) => ok({ action: "update-crowder", id: e.id, ...fields })}
                        onDelete={() => ok({ action: "remove-crowder", id: e.id })}
                        onClose={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id} className={e.reimbursed ? "text-slate" : "text-ink"}>
                    <td className="px-4 sm:px-2 py-2 whitespace-nowrap align-top">{e.date ? longDate(e.date) : "—"}</td>
                    <td className="px-2 py-2 align-top">{e.item}</td>
                    <td className="px-2 py-2 align-top whitespace-nowrap">
                      {editing ? (
                        <button
                          type="button"
                          onClick={() =>
                            ok({
                              action: "update-crowder",
                              id: e.id,
                              reimbursed: !e.reimbursed,
                              reimbursedDate: e.reimbursed ? "" : (e.reimbursedDate ?? today),
                            })
                          }
                          className={`rounded-sm px-2 py-0.5 text-xs font-bold border-2 transition-colors duration-150 ${
                            e.reimbursed
                              ? "border-green bg-green text-paper"
                              : "border-purple text-purple hover:bg-purple-tint"
                          }`}
                        >
                          {e.reimbursed ? `Yes${e.reimbursedDate ? ` · ${shortDate(e.reimbursedDate)}` : ""}` : "Mark paid"}
                        </button>
                      ) : e.reimbursed ? (
                        <span className="font-bold text-green">Yes{e.reimbursedDate ? ` · ${shortDate(e.reimbursedDate)}` : ""}</span>
                      ) : (
                        <span className="font-bold text-purple">No</span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-top text-slate">{e.notes ?? ""}</td>
                    {editing && (
                      <td className="px-2 py-2 align-top text-right">
                        <button type="button" onClick={() => setEditingId(e.id)} className={btn.ghost}>
                          ✎
                        </button>
                      </td>
                    )}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CrowderForm({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial: CrowderEntry;
  onSave: (fields: Record<string, unknown>) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(initial.date);
  const [item, setItem] = useState(initial.item);
  const [reimbursed, setReimbursed] = useState(initial.reimbursed);
  const [reimbursedDate, setReimbursedDate] = useState(initial.reimbursedDate ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const saved = await onSave({
          date,
          item: item.trim(),
          reimbursed,
          reimbursedDate: reimbursed ? reimbursedDate : "",
          notes,
        });
        setBusy(false);
        if (saved) onClose();
      }}
      className="bg-cream border-2 border-green rounded-md p-3 grid gap-2 sm:grid-cols-[9.5rem_1fr]"
    >
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={btn.input} required />
      <input
        autoFocus
        value={item}
        onChange={(e) => setItem(e.target.value)}
        placeholder="Item / count, e.g. Can Ends (GF) / 3528"
        className={btn.input}
        required
      />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={reimbursed}
          onChange={(e) => setReimbursed(e.target.checked)}
          className="accent-green"
        />
        Reimbursed
      </label>
      <div className="flex gap-2">
        {reimbursed && (
          <input
            type="date"
            value={reimbursedDate}
            onChange={(e) => setReimbursedDate(e.target.value)}
            className={`${btn.input} sm:max-w-[9.5rem]`}
            aria-label="Reimbursed date"
          />
        )}
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className={btn.input} />
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-1">
        <button type="submit" disabled={busy || !item.trim() || !date} className={`${btn.primary} py-1.5`}>
          Save
        </button>
        <button type="button" onClick={onClose} className={`${btn.secondary} py-1.5`}>
          Cancel
        </button>
        <span className="flex-1" />
        {onDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm(`Delete "${initial.item}"?`)) return;
              setBusy(true);
              const done = await onDelete();
              setBusy(false);
              if (done) onClose();
            }}
            className={btn.danger}
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

// ---- Canning run log -----------------------------------------------------

function RunLog({
  entries,
  editing,
  ok,
  today,
}: {
  entries: RunLogEntry[];
  editing: boolean;
  ok: Ok;
  today: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Newest first, grouped by month so scrolling back a season is quick.
  const months = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    const groups: { key: string; label: string; rows: RunLogEntry[] }[] = [];
    for (const e of sorted) {
      const key = e.date.slice(0, 7);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(
          new Date(`${key}-15T12:00:00Z`)
        );
        g = { key, label, rows: [] };
        groups.push(g);
      }
      g.rows.push(e);
    }
    return groups;
  }, [entries]);

  return (
    <Card title="Canning Runs" subtitle="What ran on the line, when, and how much.">
      {editing && (
        <div className="mb-3">
          {adding ? (
            <RunForm
              initial={{ id: "", date: today, text: "" }}
              onSave={(fields) => ok({ action: "add-run", ...fields })}
              onClose={() => setAdding(false)}
            />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className={btn.primary}>
              + Add run
            </button>
          )}
        </div>
      )}
      {months.length === 0 && <p className="text-sm text-slate">No runs logged.</p>}
      {months.map((m) => (
        <div key={m.key} className="mb-4 last:mb-0">
          <h3 className="text-xs font-bold uppercase tracking-eyebrow text-purple mb-2">{m.label}</h3>
          <ul className="divide-y-2 divide-line">
            {m.rows.map((e) =>
              editingId === e.id ? (
                <li key={e.id} className="py-2">
                  <RunForm
                    initial={e}
                    onSave={(fields) => ok({ action: "update-run", id: e.id, ...fields })}
                    onDelete={() => ok({ action: "remove-run", id: e.id })}
                    onClose={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li key={e.id} className="py-2 flex items-start gap-3 text-sm">
                  <span className="w-10 shrink-0 tabular-nums text-slate">{shortDate(e.date)}</span>
                  <span className="flex-1 text-ink">{e.text}</span>
                  {editing && (
                    <button type="button" onClick={() => setEditingId(e.id)} className={btn.ghost}>
                      ✎
                    </button>
                  )}
                </li>
              )
            )}
          </ul>
        </div>
      ))}
    </Card>
  );
}

function RunForm({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial: RunLogEntry;
  onSave: (fields: Record<string, unknown>) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(initial.date);
  const [text, setText] = useState(initial.text);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const saved = await onSave({ date, text: text.trim() });
        setBusy(false);
        if (saved) onClose();
      }}
      className="bg-cream border-2 border-green rounded-md p-3 grid gap-2 sm:grid-cols-[9.5rem_1fr]"
    >
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={btn.input} required />
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Sherpa Mango - 15,000 units - 600 cases — Split Shift 7-7"
        className={btn.input}
        required
      />
      <div className="sm:col-span-2 flex flex-wrap items-center gap-1">
        <button type="submit" disabled={busy || !text.trim() || !date} className={`${btn.primary} py-1.5`}>
          Save
        </button>
        <button type="button" onClick={onClose} className={`${btn.secondary} py-1.5`}>
          Cancel
        </button>
        <span className="flex-1" />
        {onDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Delete this run?")) return;
              setBusy(true);
              const done = await onDelete();
              setBusy(false);
              if (done) onClose();
            }}
            className={btn.danger}
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
