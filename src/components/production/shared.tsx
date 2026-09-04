"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Small building blocks the production tabs share: an inline "+ Add" input,
// an inline text editor with save/delete, and consistent button styles.
//
// Styling follows the Lively Beerworks design system: flat color blocks,
// crisp 2px keylines, small radii, Platform Bold for anything clickable, and
// the signature hard-offset block shadow on the primary action (it collapses
// on press so the button reads as physically pushed).

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-1.5 bg-green text-paper font-bold px-4 py-2 rounded-md text-sm border-2 border-green shadow-block-sm transition-[background-color,box-shadow,transform] duration-150 hover:bg-green-deep hover:border-green-deep active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-x-0 disabled:active:translate-y-0",
  secondary:
    "inline-flex items-center justify-center gap-1.5 bg-paper text-ink font-bold px-3 py-2 rounded-md text-sm border-2 border-ink transition-colors duration-150 hover:bg-ink hover:text-paper disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-paper disabled:hover:text-ink",
  // Yellow-on-purple is the brand's "active / look here" pairing; used for
  // the header's Done button while editing is unlocked.
  yellow:
    "inline-flex items-center justify-center gap-1.5 bg-yellow text-purple font-bold px-4 py-2 rounded-md text-sm border-2 border-yellow transition-colors duration-150 hover:bg-yellow-deep hover:border-yellow-deep disabled:opacity-40 disabled:cursor-not-allowed",
  // Outline buttons that sit on the green header bar.
  onGreen:
    "inline-flex items-center justify-center gap-1.5 bg-transparent text-paper font-bold px-3 py-2 rounded-md text-sm border-2 border-paper/70 transition-colors duration-150 hover:bg-paper hover:text-green hover:border-paper disabled:opacity-40 disabled:cursor-not-allowed",
  ghost: "text-xs font-bold text-slate hover:text-green px-2 py-1 rounded-sm transition-colors duration-150",
  ghostOnGreen:
    "text-xs font-bold text-paper/80 hover:text-paper hover:underline underline-offset-4 px-2 py-1 rounded-sm transition-colors duration-150",
  danger:
    "text-xs font-bold text-critical hover:bg-critical-tint px-2 py-1 rounded-sm transition-colors duration-150",
  input:
    "bg-paper border-2 border-line rounded-md px-3 py-2 text-base text-ink placeholder:text-slate w-full transition-colors duration-150 focus:outline-none focus:border-green disabled:opacity-60",
} as const;

// Selectable pill used for tabs, the phone's day picker, and the TV control
// bar: solid green when active, keyline when not.
export function chip(active: boolean) {
  return `shrink-0 inline-flex items-center gap-1.5 rounded-md border-2 px-3.5 py-2 text-sm font-bold leading-tight transition-colors duration-150 ${
    active
      ? "border-green bg-green text-paper"
      : "border-line bg-paper text-ink hover:border-green hover:text-green"
  }`;
}

// One-line-at-a-time text box that wraps and grows with its content, so a
// long task in a narrow schedule cell stays fully visible while you type.
// Enter submits (tasks are single entries; newlines are never kept).
export function GrowInput({
  inputRef,
  value,
  onChange,
  onSubmit,
  onEscape,
  onPaste,
  placeholder,
  disabled,
  className,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onEscape: () => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [inputRef, value]);

  return (
    <textarea
      ref={inputRef}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit();
        } else if (e.key === "Escape") {
          onEscape();
        }
      }}
      onPaste={onPaste}
      placeholder={placeholder}
      disabled={disabled}
      className={`${btn.input} resize-none overflow-hidden leading-snug ${className ?? ""}`}
    />
  );
}

export function Flash({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 bg-yellow text-purple text-sm font-bold px-4 py-2 rounded-md border-2 border-purple shadow-block-purple no-print">
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  const pasteList = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
            ? "text-xs font-bold text-green/80 hover:text-green py-1 transition-colors duration-150"
            : "text-sm font-bold text-green border-2 border-dashed border-green/50 hover:border-green hover:bg-green-tint rounded-md px-3 py-2 w-full text-left transition-colors duration-150"
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
      <GrowInput
        inputRef={inputRef}
        value={text}
        onChange={setText}
        onSubmit={submit}
        onEscape={() => {
          setOpen(false);
          setText("");
        }}
        onPaste={pasteList}
        placeholder={pasting ? "Adding…" : placeholder}
        disabled={pasting}
        className="py-1.5 text-sm"
      />
      <div className="flex gap-1">
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
      {error && <p className="text-xs font-bold text-critical">{error}</p>}
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      className="bg-cream border-2 border-green rounded-md p-2 space-y-2"
    >
      <GrowInput
        inputRef={inputRef}
        value={text}
        onChange={setText}
        onSubmit={() => {
          if (text.trim() && text.trim() !== initial) run(() => onSave(text.trim()), true);
          else onClose();
        }}
        onEscape={onClose}
        className="py-1.5 text-sm"
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
      {error && <p className="text-xs font-bold text-critical">{error}</p>}
    </form>
  );
}

// Section wrapper used on every tab: solid paper surface, crisp keyline,
// small radius — no drop shadow (the brand favors flat blocks).
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
    <section className="bg-paper border-2 border-line rounded-lg p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-bold text-ink tracking-tight leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
