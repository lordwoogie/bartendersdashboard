"use client";

import { useEffect, useState } from "react";
import { zonedWallTimeToUtc } from "@/lib/timezone";
import type { Announcement } from "@/lib/announcements";

// Announcement pop-up over the dashboard. The message is managed from
// /admin (no deploy needed); this just renders whatever /api/announcement
// says. Dismissing snoozes it for 12 hours per device so each shift still
// sees it, and it hides itself once the announcement's last day ends. The
// tablet stays open for days at a time, so the announcement, the snooze
// lapse, and the expiry are all re-checked on a timer, not just at load.

const SNOOZE_MS = 12 * 60 * 60 * 1000; // 12 hours
const snoozeKey = (id: string) => `announce-snooze-${id}`;
const FETCH_EVERY_MS = 60_000;

export function AnnouncementPopup() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      let a: Announcement | null = announcement;
      try {
        const res = await fetch("/api/announcement", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          a = data.announcement || null;
        }
      } catch {
        // Offline — fall back to whatever we last fetched.
      }
      if (cancelled) return;
      setAnnouncement(a);

      if (!a || !a.enabled || !a.message) {
        setOpen(false);
        return;
      }
      // Retired once the last day ends (venue time).
      const end = zonedWallTimeToUtc(a.lastDay, "23:59");
      if (!Number.isNaN(end.getTime()) && Date.now() > end.getTime() + 60_000) {
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
    const timer = setInterval(check, FETCH_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!announcement || !open) return null;

  const close = () => {
    window.localStorage.setItem(
      snoozeKey(announcement.id),
      String(Date.now())
    );
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
            📣 Heads up
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
          <p className="text-lg font-semibold text-foreground leading-snug whitespace-pre-wrap">
            {announcement.message}
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
