"use client";

import { useState } from "react";
import type { AvailabilityEntry, ProductionData } from "@/lib/production";
import type { ActionResult } from "@/lib/use-production";
import { AddInline, Card, btn } from "./shared";

// Availability / vacation. Mirrors the sheet: a Confirmed column the head
// brewer owns and a Requests column anyone can add to ("add dates you know
// you will be gone to the request column — I will move it after I've seen
// it").

type Act = (payload: Record<string, unknown>) => Promise<ActionResult>;

interface Props {
  data: ProductionData;
  editing: boolean;
  act: Act;
  flash: (message: string) => void;
}

const OTHER = "__other__";

export function AvailabilityTab({ data, editing, act, flash }: Props) {
  const { people, entries } = data.availability;
  const [editingId, setEditingId] = useState<string | null>(null);

  // Anyone whose entries survived being removed from the roster still shows.
  const roster = [...people];
  for (const e of entries) if (!roster.includes(e.person)) roster.push(e.person);

  const pending = entries.filter((e) => e.status === "request");

  const ok = async (payload: Record<string, unknown>) => {
    const res = await act(payload);
    if (!res.ok) flash(res.error);
    return res.ok;
  };

  const chip = (e: AvailabilityEntry) => {
    if (editingId === e.id) {
      return (
        <EntryEditor
          key={e.id}
          entry={e}
          onSave={(fields) => ok({ action: "update-availability", id: e.id, ...fields })}
          onDelete={() => ok({ action: "remove-availability", id: e.id })}
          onClose={() => setEditingId(null)}
        />
      );
    }
    const classes =
      e.status === "confirmed"
        ? "border-green-800 bg-green-950/40 text-green-200"
        : "border-dashed border-amber/60 bg-amber/5 text-amber";
    const body = (
      <>
        <span className="font-medium">{e.dates}</span>
        {e.note && <span className="text-xs opacity-80"> — {e.note}</span>}
        {e.status === "request" && <span className="text-[10px] uppercase tracking-wider opacity-70 ml-1">pending</span>}
      </>
    );
    if (!editing) {
      return (
        <span key={e.id} className={`inline-block text-sm rounded-md px-2 py-1 border ${classes}`}>
          {body}
        </span>
      );
    }
    return (
      <span key={e.id} className="inline-flex items-stretch gap-0.5">
        <button
          type="button"
          onClick={() => setEditingId(e.id)}
          className={`text-left text-sm rounded-md px-2 py-1 border ${classes} hover:border-amber`}
        >
          {body} <span className="text-xs opacity-60">✎</span>
        </button>
        {e.status === "request" && (
          <button
            type="button"
            onClick={() => ok({ action: "update-availability", id: e.id, status: "confirmed" })}
            className="text-xs rounded-md px-2 border border-green-800 bg-green-950/40 text-green-200 hover:bg-green-900/60"
            title="Move to confirmed"
          >
            ✓ Confirm
          </button>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <RequestForm people={people} act={act} flash={flash} />

      {editing && pending.length > 0 && (
        <div className="text-sm text-amber bg-amber/10 border border-amber/30 rounded-xl px-4 py-2">
          {pending.length} request{pending.length === 1 ? "" : "s"} waiting to be confirmed — tap ✓ Confirm next to it.
        </div>
      )}

      <Card title="Time off" subtitle="Green is confirmed. Dashed amber is a request the head brewer hasn't moved yet.">
        <div className="hidden sm:grid grid-cols-[7rem_1fr_1fr] gap-3 text-[11px] uppercase tracking-wider text-muted font-semibold border-b border-card-border pb-2 mb-1">
          <div>Who</div>
          <div>Confirmed</div>
          <div>Requests</div>
        </div>
        <ul className="divide-y divide-card-border">
          {roster.map((person) => {
            const mine = entries.filter((e) => e.person === person);
            const confirmed = mine.filter((e) => e.status === "confirmed");
            const requests = mine.filter((e) => e.status === "request");
            return (
              <li key={person} className="py-3 sm:grid sm:grid-cols-[7rem_1fr_1fr] sm:gap-3 space-y-2 sm:space-y-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{person}</span>
                  {editing && people.includes(person) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove ${person} from the list? Their dates stay.`)) {
                          ok({ action: "remove-person", name: person });
                        }
                      }}
                      aria-label={`Remove ${person}`}
                      className={btn.danger}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="sm:hidden text-[10px] uppercase tracking-wider text-muted">Confirmed</div>
                  <div className="flex flex-wrap gap-1.5">
                    {confirmed.length === 0 && !editing && <span className="text-sm text-muted">—</span>}
                    {confirmed.map(chip)}
                  </div>
                  {editing && (
                    <AddInline
                      compact
                      label="Add confirmed dates"
                      placeholder="e.g. 10/8 - 10/16"
                      onAdd={(dates) => ok({ action: "add-availability", person, dates, status: "confirmed" })}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="sm:hidden text-[10px] uppercase tracking-wider text-muted">Requests</div>
                  <div className="flex flex-wrap gap-1.5">
                    {requests.length === 0 && <span className="text-sm text-muted">—</span>}
                    {requests.map(chip)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {editing && (
          <div className="mt-4 max-w-xs">
            <AddInline
              label="Add a person"
              placeholder="Name"
              onAdd={(name) => ok({ action: "add-person", name })}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function RequestForm({
  people,
  act,
  flash,
}: {
  people: string[];
  act: Act;
  flash: (message: string) => void;
}) {
  const [person, setPerson] = useState(people[0] ?? OTHER);
  const [otherName, setOtherName] = useState("");
  const [dates, setDates] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const name = person === OTHER ? otherName.trim() : person;
  const valid = Boolean(name && dates.trim());

  return (
    <Card title="Request time off" subtitle="Add dates you know you'll be gone. The head brewer confirms them.">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setBusy(true);
          setError("");
          const res = await act({
            action: "add-availability-request",
            person: name,
            dates: dates.trim(),
            note: note.trim() || undefined,
          });
          setBusy(false);
          if (res.ok) {
            setDates("");
            setNote("");
            flash(`Request added for ${name}`);
          } else {
            setError(res.error);
          }
        }}
        className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr_auto]"
      >
        <div className="flex flex-col gap-2">
          <select value={person} onChange={(e) => setPerson(e.target.value)} className={btn.input}>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={OTHER}>Someone else…</option>
          </select>
          {person === OTHER && (
            <input
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="Your name"
              className={btn.input}
            />
          )}
        </div>
        <input
          value={dates}
          onChange={(e) => setDates(e.target.value)}
          placeholder="Dates, e.g. 9/25 - 10/4"
          className={btn.input}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className={btn.input}
        />
        <button type="submit" disabled={!valid || busy} className={btn.primary}>
          Request
        </button>
      </form>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </Card>
  );
}

function EntryEditor({
  entry,
  onSave,
  onDelete,
  onClose,
}: {
  entry: AvailabilityEntry;
  onSave: (fields: Record<string, unknown>) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [dates, setDates] = useState(entry.dates);
  const [note, setNote] = useState(entry.note ?? "");
  const [status, setStatus] = useState(entry.status);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await onSave({ dates: dates.trim(), note, status });
        setBusy(false);
        if (ok) onClose();
      }}
      className="w-full bg-surface border border-amber/40 rounded-lg p-2 space-y-2"
    >
      <input
        autoFocus
        value={dates}
        onChange={(e) => setDates(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Dates"
        className={`${btn.input} py-1.5 text-sm`}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className={`${btn.input} py-1.5 text-sm`}
      />
      <div className="flex flex-wrap items-center gap-1">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AvailabilityEntry["status"])}
          className={`${btn.input} w-auto py-1.5 text-sm`}
        >
          <option value="confirmed">Confirmed</option>
          <option value="request">Request</option>
        </select>
        <button type="submit" disabled={busy || !dates.trim()} className={`${btn.primary} py-1 px-3`}>
          Save
        </button>
        <button type="button" onClick={onClose} className={`${btn.secondary} py-1 px-2`}>
          Cancel
        </button>
        <span className="flex-1" />
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(`Delete ${entry.person}'s "${entry.dates}"?`)) return;
            setBusy(true);
            const ok = await onDelete();
            setBusy(false);
            if (ok) onClose();
          }}
          className={btn.danger}
        >
          Delete
        </button>
      </div>
    </form>
  );
}
