"use client";

import { useEffect, useState } from "react";
import { zonedWallTimeToUtc } from "@/lib/timezone";

// One-off announcement pop-up over the dashboard. The message lives here in
// code — to change or retire it, edit ANNOUNCEMENT (or set it to null to turn
// the pop-up off entirely). Dismissing snoozes it for 12 hours per device so
// each shift still sees it, and it retires itself after `lastDay` with no
// deploy needed.

interface Announcement {
  id: string; // bump this when the message changes so old snoozes don't hide it
  emoji: string;
  title: string;
  message: string;
  lastDay: string; // YYYY-MM-DD, venue time — hidden after this day ends
}

const ANNOUNCEMENT: Announcement | null = {
  id: "trivia-cancelled-aug-2026",
  emoji: "🚫",
  title: "Heads up",
  message: "Trivia is cancelled for the month of August.",
  lastDay: "2026-08-31",
};

const SNOOZE_MS = 12 * 60 * 60 * 1000; // 12 hours
const snoozeKey = (id: string) => `announce-snooze-${id}`;

export function AnnouncementPopup() {
  const [open, setOpen] = useState(false);

  // The tablet stays open for days at a time, so both the snooze lapse and
  // the expiry are re-checked on a timer, not just at page load.
  useEffect(() => {
    if (!ANNOUNCEMENT) return;
    const a = ANNOUNCEMENT;
    const check = () => {
      // Day after lastDay, midnight venue time = the moment it retires.
      const end = zonedWallTimeToUtc(a.lastDay, "23:59");
      if (Date.now() > end.getTime() + 60_000) {
        setOpen(false);
        return;
      }
      const last = parseInt(
        window.localStorage.getItem(snoozeKey(a.id)) || "0",
        10
      );
      if (Date.now() - (Number.isFinite(last) ? last : 0) >= SNOOZE_MS) {
        setOpen(true);
      }
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!ANNOUNCEMENT || !open) return null;
  const a = ANNOUNCEMENT;

  const close = () => {
    window.localStorage.setItem(snoozeKey(a.id), String(Date.now()));
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Announcement"
    >
      <div className="absolute inset-0 bg-black/70" onClick={close} />

      <div className="relative w-full max-w-md rounded-2xl border border-amber/50 bg-card-bg shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-card-border px-4 py-3">
          <h2 className="text-sm font-semibold text-amber uppercase tracking-wider">
            {a.emoji} {a.title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="shrink-0 h-9 w-9 rounded-lg border border-card-border bg-surface text-foreground text-lg leading-none hover:border-amber hover:text-amber transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          <p className="text-lg font-semibold text-foreground leading-snug">
            {a.message}
          </p>
          <button
            type="button"
            onClick={close}
            className="mt-5 w-full bg-surface border border-card-border hover:border-amber text-foreground font-medium py-2.5 rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
