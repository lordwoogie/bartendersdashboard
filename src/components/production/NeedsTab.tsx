"use client";

import { useState } from "react";
import { NEED_GROUPS, type NeedItem, type ProductionData } from "@/lib/production";
import type { ActionResult } from "@/lib/use-production";
import { AddInline, Card, TextEditor } from "./shared";

// "NEEDS TO HAPPEN": three running lists — production to-dos, things to
// order (BSG, Amoretti…), and everything else. Anyone can check an item off;
// adding and editing is the head brewer's.

type Act = (
  payload: Record<string, unknown>,
  optimistic?: (current: ProductionData) => ProductionData
) => Promise<ActionResult>;

interface Props {
  data: ProductionData;
  editing: boolean;
  act: Act;
  flash: (message: string) => void;
}

export function NeedsTab({ data, editing, act, flash }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggle = async (item: NeedItem) => {
    const res = await act({ action: "toggle-need", id: item.id }, (d) => ({
      ...d,
      needs: d.needs.map((n) =>
        n.id === item.id ? { ...n, doneAt: n.doneAt ? undefined : new Date().toISOString() } : n
      ),
    }));
    if (!res.ok) flash(res.error);
  };

  const ok = async (payload: Record<string, unknown>) => {
    const res = await act(payload);
    if (!res.ok) flash(res.error);
    return res.ok;
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {NEED_GROUPS.map((group) => {
        const items = data.needs.filter((n) => n.group === group.key);
        const open = items.filter((n) => !n.doneAt);
        const done = items.filter((n) => n.doneAt);
        const render = (item: NeedItem) =>
          editingId === item.id ? (
            <li key={item.id}>
              <TextEditor
                initial={item.text}
                onSave={(text) => ok({ action: "update-need", id: item.id, text })}
                onDelete={() => ok({ action: "remove-need", id: item.id })}
                onClose={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li key={item.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-label={item.doneAt ? "Mark not done" : "Mark done"}
                className={`mt-0.5 w-6 h-6 shrink-0 rounded-sm border-2 flex items-center justify-center text-[13px] font-bold transition-colors duration-150 ${
                  item.doneAt ? "bg-green border-green text-paper" : "border-ink/50 bg-paper hover:border-green"
                }`}
              >
                {item.doneAt ? "✓" : ""}
              </button>
              {editing ? (
                <button
                  type="button"
                  onClick={() => setEditingId(item.id)}
                  className={`flex-1 text-left text-sm ${item.doneAt ? "line-through text-slate" : "text-ink"} hover:text-green`}
                >
                  {item.text} <span className="text-slate text-xs">✎</span>
                </button>
              ) : (
                <span className={`flex-1 text-sm ${item.doneAt ? "line-through text-slate" : "text-ink"}`}>
                  {item.text}
                </span>
              )}
            </li>
          );
        return (
          <Card key={group.key} title={group.label} subtitle={`${open.length} open`}>
            {open.length === 0 && done.length === 0 && (
              <p className="text-sm text-slate mb-3">Nothing here.</p>
            )}
            {open.length > 0 && <ul className="space-y-2 mb-3">{open.map(render)}</ul>}
            {editing && (
              <AddInline
                placeholder={group.key === "order" ? "e.g. BSG: 10 bags Pilsner" : "What needs to happen"}
                onAdd={(text) => ok({ action: "add-need", group: group.key, text })}
              />
            )}
            {done.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-bold text-slate cursor-pointer hover:text-green">
                  Done ({done.length})
                </summary>
                <ul className="space-y-2 mt-2">{done.map(render)}</ul>
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}
