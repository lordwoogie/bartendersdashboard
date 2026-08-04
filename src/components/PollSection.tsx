"use client";

import { useCallback, useEffect, useState } from "react";
import type { Poll } from "@/lib/poll";

// Staff poll card on the dashboard. Voting needs initials, which both keeps
// one person from stacking the ballot and lets a returning voter see what
// they already picked.

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

export function PollSection() {
  const [data, setData] = useState<PollResponse | null>(null);
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
      // Offline or the poll endpoint is down — the card just stays hidden.
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

  if (!data) return null;

  const { poll, counts, total, closed, yourVote } = data;
  const showResults = Boolean(yourVote) || closed;

  return (
    <section className="mb-6 rounded-xl border border-amber/50 bg-gradient-to-br from-card-bg to-surface p-4">
      <div className="flex items-center justify-between mb-1 gap-3">
        <h2 className="text-sm font-semibold text-amber uppercase tracking-wider">
          🗳 Staff Vote
        </h2>
        <span className="text-xs text-muted shrink-0">
          {total} vote{total === 1 ? "" : "s"}
          {closed && " · closed"}
        </span>
      </div>
      <h3 className="text-base font-semibold text-foreground">{poll.question}</h3>
      {poll.intro && !showResults && (
        <p className="text-xs text-muted mt-1">{poll.intro}</p>
      )}

      {justVoted && (
        <p className="text-sm text-amber mt-3">
          Thanks — your vote is in. ✓
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
    </section>
  );
}
