"use client";

import { useEffect, useRef, useState } from "react";

// Small building blocks the production tabs share: an inline "+ Add" input,
// an inline text editor with save/delete, and consistent button styles.

export const btn = {
  primary:
    "bg-amber text-background font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed",
  secondary:
    "bg-surface hover:bg-card-border text-foreground px-3 py-2 rounded-lg text-sm border border-card-border disabled:opacity-40",
  ghost: "text-xs text-muted hover:text-amber px-2 py-1 rounded",
  danger: "text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded",
  input:
    "bg-surface border border-card-border rounded-lg px-3 py-2 text-base text-foreground w-full focus:outline-none focus:border-amber",
} as const;

export function Flash({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 bg-amber text-background text-sm font-medium px-4 py-2 rounded-lg shadow-lg no-print">
      {message}
    </div>
  );
}

// "+ Add" that turns into a text input. Enter saves and keeps the input open
// for the next entry (building a day is usually several items in a row);
// Escape or the × closes it. A failed save hands the text back. Pasting a
// multi-line list (say, a column copied out of the old spreadsheet) adds
// one item per line.
export function AddInline({
  placeholder,
  onAdd,
  compact,
  label = "Add",
}: {
  placeholder: string;
  onAdd: (text: string) => Promise<boolean>;
  compact?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    setError("");
    const ok = await onAdd(t);
    if (!ok) {
      setText(t);
      setError("Couldn't save — try again");
    } else {
      inputRef.current?.focus();
    }
  };

  const [pasting, setPasting] = useState(false);
  const pasteList = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const lines = e.clipboardData
      .getData("text")
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s•\-–*]+/, "").trim())
      .filter(Boolean);
    if (lines.length < 2) return; // single line: let the input take it
    e.preventDefault();
    setPasting(true);
    setError("");
    const failed: string[] = [];
    for (const line of lines) {
      if (!(await onAdd(line))) failed.push(line);
    }
    setPasting(false);
    if (failed.length) {
      setText(failed.join(" / "));
      setError(`${failed.length} of ${lines.length} didn't save — they're back in the box`);
    }
    inputRef.current?.focus();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "text-xs text-amber/70 hover:text-amber py-1"
            : "text-sm text-amber/80 hover:text-amber border border-dashed border-amber/40 hover:border-amber rounded-lg px-3 py-2 w-full text-left"
        }
      >
        + {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-1"
    >
      <div className="flex gap-1">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setText("");
            }
          }}
          onPaste={pasteList}
          placeholder={pasting ? "Adding…" : placeholder}
          disabled={pasting}
          className={`${btn.input} py-1.5 text-sm`}
        />
        <button type="submit" disabled={!text.trim() || pasting} className={`${btn.primary} py-1.5 px-3`}>
          Add
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className={`${btn.secondary} py-1.5 px-2`}
        >
          ×
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}

// Inline editor for a single line of text with optional reorder + delete.
// `children` renders extra controls (e.g. "move to another day") below.
export function TextEditor({
  initial,
  onSave,
  onDelete,
  onMove,
  onClose,
  children,
}: {
  initial: string;
  onSave: (text: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onMove?: (direction: -1 | 1) => Promise<boolean>;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const run = async (fn: () => Promise<boolean>, closeAfter: boolean) => {
    setBusy(true);
    setError("");
    const ok = await fn();
    setBusy(false);
    if (!ok) setError("Couldn't save — try again");
    else if (closeAfter) onClose();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && text.trim() !== initial) run(() => onSave(text.trim()), true);
        else onClose();
      }}
      className="bg-surface border border-amber/40 rounded-lg p-2 space-y-2"
    >
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className={`${btn.input} py-1.5 text-sm`}
      />
      <div className="flex flex-wrap items-center gap-1">
        <button type="submit" disabled={busy || !text.trim()} className={`${btn.primary} py-1 px-3`}>
          Save
        </button>
        <button type="button" onClick={onClose} className={`${btn.secondary} py-1 px-2`}>
          Cancel
        </button>
        {onMove && (
          <>
            <button
              type="button"
              aria-label="Move up"
              disabled={busy}
              onClick={() => run(() => onMove(-1), false)}
              className={`${btn.secondary} py-1 px-2`}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={busy}
              onClick={() => run(() => onMove(1), false)}
              className={`${btn.secondary} py-1 px-2`}
            >
              ↓
            </button>
          </>
        )}
        <span className="flex-1" />
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Delete "${initial}"?`)) run(onDelete, true);
          }}
          className={btn.danger}
        >
          Delete
        </button>
      </div>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}

// Section wrapper used on every tab.
export function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-card-bg border border-card-border rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-amber">{title}</h2>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
