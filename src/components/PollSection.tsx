"use client";

import { useCallback, useEffect, useState } from "react";
import type { Poll } from "@/lib/poll";

// Staff poll, shown as a pop-up over the dashboard. It reappears every 12
// hours (per device) so each shift sees it, and dismissing it snoozes it for
// 12 hours rather than killing it — the tablet stays open all day, so the
// snooze is re-checked on a timer, not just on page load. Voting needs
// initials, which both keeps one person from stacking the ballot and lets a
// returning voter see what they already picked.

interface PollResponse {
  poll: Poll;
  counts: Record<string, number>;
  total: number;
  closed: boolean;
  yourVote: string | null;
}

// Remembering the initials locally means the tablet shows your result on the
// next visit without making you type them again. It is a convenience, not the
// check — the server is what enforces one vote per set of initials.
const INITIALS_KEY = "poll-initials";

const SNOOZE_MS = 12 * 60 * 60 * 1000; // 12 hours
const snoozeKey = (pollId: string) => `poll-snooze-${pollId}`;

export function PollSection() {
  const [data, setData] = useState<PollResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [initials, setInitials] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [justVoted, setJustVoted] = useState(false);

  const load = useCallback(async (who: string) => {
    try {
      const q = who ? `?initials=${encodeURIComponent(who)}` : "";
      const res = await fetch(`/api/poll${q}`, { cache: "no-store" });
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      // Offline or the poll endpoint is down — the pop-up just stays hidden.
    }
  }, []);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(INITIALS_KEY) || ""
        : "";
    if (saved) setInitials(saved);
    load(saved);
  }, [load]);

  // Pop up when the snooze has lapsed. The dashboard tablet stays open for
  // days at a time, so this is checked every minute — waiting for a reload
  // would mean the pop-up effectively never came back.
  useEffect(() => {
    if (!data) return;
    const check = () => {
      const last = parseInt(
        window.localStorage.getItem(snoozeKey(data.poll.id)) || "0",
        10
      );
      if (Date.now() - (Number.isFinite(last) ? last : 0) >= SNOOZE_MS) {
        setOpen(true);
      }
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [data]);

  // Keep the page behind the pop-up from scrolling while it's open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => {
    if (data) {
      window.localStorage.setItem(snoozeKey(data.poll.id), String(Date.now()));
    }
    setOpen(false);
  };

  const submit = async () => {
    if (!selected) {
      setError("Pick an option first.");
      return;
    }
    if (!initials.trim()) {
      setError("Add your initials so we know it's one vote per person.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initials, optionId: selected }),
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || "Couldn't record that vote — try again.");
        // A duplicate still tells us what they picked, so show their result.
        if (body?.yourVote) {
          setData((d) => (d ? { ...d, ...body, yourVote: body.yourVote } : d));
        }
        return;
      }
      window.localStorage.setItem(INITIALS_KEY, initials);
      setJustVoted(true);
      setData((d) =>
        d
          ? { ...d, counts: body.counts, total: body.total, yourVote: body.yourVote }
          : d
      );
    } catch {
      setError("Couldn't record that vote — check the wifi and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!data || !open) return null;

  const { poll, counts, total, closed, yourVote } = data;
  const showResults = Boolean(yourVote) || closed;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Staff vote"
    >
      {/* Backdrop — clicking it closes (snoozes) like the ✕ button. */}
      <div className="absolute inset-0 bg-black/70" onClick={close} />

      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-amber/50 bg-card-bg shadow-2xl">
        {/* Header with the exit button, pinned while the ballot scrolls. */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-card-bg/95 backdrop-blur border-b border-card-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-amber uppercase tracking-wider">
              🗳 Staff Vote
            </h2>
            <p className="text-xs text-muted mt-0.5">
              If you&apos;ve already voted, you can exit out of this window.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="shrink-0 h-9 w-9 rounded-lg border border-card-border bg-surface text-foreground text-lg leading-none hover:border-amber hover:text-amber transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">
              {poll.question}
            </h3>
            <span className="text-xs text-muted shrink-0">
              {total} vote{total === 1 ? "" : "s"}
              {closed && " · closed"}
            </span>
          </div>
          {poll.intro && !showResults && (
            <p className="text-xs text-muted mt-1">{poll.intro}</p>
          )}

          {justVoted && (
            <p className="text-sm text-amber mt-3">
              Thanks — your vote is in. You can close this window now. ✓
            </p>
          )}

          <div className="mt-3 space-y-2">
            {poll.options.map((o) => {
              const count = counts[o.id] ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const isMine = yourVote === o.id;
              const isPicked = selected === o.id;

              return (
                <div
                  key={o.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isMine
                      ? "border-amber bg-amber/10"
                      : isPicked
                        ? "border-amber/70 bg-surface"
                        : "border-card-border bg-surface/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => !showResults && setSelected(o.id)}
                    disabled={showResults}
                    className={`w-full text-left ${showResults ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <div className="flex items-start gap-2">
                      {!showResults && (
                        <span
                          className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                            isPicked ? "border-amber bg-amber" : "border-copper/60"
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {o.title}
                          {isMine && (
                            <span className="text-amber text-xs font-normal">
                              {" "}
                              · your vote
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted mt-0.5">{o.summary}</p>
                        <ul className="mt-1.5 space-y-0.5">
                          {o.details.map((d, i) => (
                            <li key={i} className="text-xs text-foreground/80">
                              • {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </button>

                  {showResults && (
                    <div className="mt-2.5">
                      <div className="h-2 w-full rounded-full bg-background/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted mt-1">
                        {count} vote{count === 1 ? "" : "s"} · {pct}%
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {poll.bothWays && poll.bothWays.length > 0 && (
            <div className="mt-3 rounded-lg border border-card-border bg-background/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-copper font-semibold mb-1">
                Applies either way
              </p>
              <ul className="space-y-0.5">
                {poll.bothWays.map((r, i) => (
                  <li key={i} className="text-xs text-foreground/80">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!showResults && !closed && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                placeholder="Your initials"
                maxLength={4}
                aria-label="Your initials"
                className="w-32 bg-surface border border-card-border rounded-lg px-3 py-2.5 text-base text-foreground uppercase"
              />
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="bg-amber text-background font-semibold px-6 py-2.5 rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : "Vote"}
              </button>
              <span className="text-[11px] text-muted">One vote per person.</span>
            </div>
          )}

          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

          {showResults && (
            <button
              type="button"
              onClick={close}
              className="mt-4 w-full bg-surface border border-card-border hover:border-amber text-foreground font-medium py-2.5 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
