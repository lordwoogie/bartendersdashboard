"use client";

import { useState, useSyncExternalStore } from "react";
import { BackToDashboard } from "@/components/BackToDashboard";
import { useProduction } from "@/lib/use-production";
import { dateKeyInZone } from "@/lib/timezone";
import { ScheduleTab } from "./ScheduleTab";
import { NeedsTab } from "./NeedsTab";
import { AvailabilityTab } from "./AvailabilityTab";
import { LogsTab } from "./LogsTab";
import { Flash, btn } from "./shared";

// /production — the brewery's week at a glance. Everyone can read it and
// check tasks off; the head brewer unlocks editing with the production
// password (kept on the device until they sign out).

const TABS = [
  { key: "schedule", label: "Schedule", icon: "📅" },
  { key: "needs", label: "Needs to Happen", icon: "📌" },
  { key: "availability", label: "Availability", icon: "🏖️" },
  { key: "logs", label: "Logs", icon: "📒" },
] as const;

type Tab = (typeof TABS)[number]["key"];

function tabFromHash(): Tab {
  const hash = window.location.hash.replace("#", "");
  return (TABS.find((t) => t.key === hash)?.key ?? "schedule") as Tab;
}

// The active tab lives in the URL hash so links like /production#needs work
// and a refresh keeps your place. Read through useSyncExternalStore so the
// server render (no hash) and the client agree during hydration.
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const serverTab = (): Tab => "schedule";

// Today in Central time; null on the server so no date-dependent markup is
// rendered until the browser's clock is available.
const noSubscribe = () => () => {};
const clientToday = () => dateKeyInZone(new Date());
const serverToday = () => null;

export function ProductionPage() {
  const { data, loaded, loadError, canEdit, login, logout, act, refresh } = useProduction();
  const tab = useSyncExternalStore(subscribeHash, tabFromHash, serverTab);
  const today = useSyncExternalStore(noSubscribe, clientToday, serverToday);
  const [editing, setEditing] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [flash, setFlash] = useState("");

  const selectTab = (next: Tab) => {
    // replaceState so the back button still leaves the page in one step;
    // it doesn't fire hashchange on its own, so nudge the subscribers.
    window.history.replaceState(null, "", `#${next}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const showFlash = (message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(""), 2500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-card-border px-4 py-3 no-print">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <BackToDashboard />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-amber tracking-tight">🏭 Production</h1>
              <p className="text-xs sm:text-sm text-muted mt-0.5">
                {editing ? "Editing — changes save as you go." : "Tap a task to check it off."}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing((e) => !e)}
                    className={editing ? btn.primary : btn.secondary}
                  >
                    {editing ? "Done" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      logout();
                    }}
                    className={btn.ghost}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setShowLogin(true)} className={btn.secondary}>
                  Edit
                </button>
              )}
              <button type="button" onClick={() => window.print()} className={`${btn.ghost} hidden sm:inline`}>
                Print
              </button>
            </div>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "border-amber bg-amber/15 text-amber"
                    : "border-card-border bg-surface text-foreground hover:border-amber hover:text-amber"
                }`}
              >
                <span aria-hidden="true" className="mr-1.5">
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5">
        {!loaded || !today ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">🍺</div>
              <p className="text-muted">Loading the board…</p>
            </div>
          </div>
        ) : !data ? (
          <div className="rounded-xl border border-card-border bg-card-bg p-6 text-center space-y-3">
            <p className="text-muted">{loadError || "Couldn't load the schedule."}</p>
            <button type="button" onClick={refresh} className={btn.secondary}>
              Try again
            </button>
          </div>
        ) : (
          <>
            {loadError && (
              <div className="mb-4 text-sm text-red-300 bg-red-950/40 border border-red-900/60 rounded-xl px-4 py-2">
                {loadError}
              </div>
            )}
            {tab === "schedule" && (
              <ScheduleTab data={data} editing={editing} act={act} today={today} flash={showFlash} />
            )}
            {tab === "needs" && <NeedsTab data={data} editing={editing} act={act} flash={showFlash} />}
            {tab === "availability" && (
              <AvailabilityTab data={data} editing={editing} act={act} flash={showFlash} />
            )}
            {tab === "logs" && <LogsTab data={data} editing={editing} act={act} flash={showFlash} today={today} />}
          </>
        )}
      </main>

      {showLogin && (
        <LoginDialog
          onClose={() => setShowLogin(false)}
          onSubmit={async (pw) => {
            const ok = await login(pw);
            if (ok) {
              setShowLogin(false);
              setEditing(true);
            }
            return ok;
          }}
        />
      )}

      <Flash message={flash} />
    </div>
  );
}

function LoginDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (password: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const ok = await onSubmit(password);
          setBusy(false);
          if (!ok) setError("That password didn't work.");
        }}
        className="w-full max-w-sm bg-card-bg border border-card-border rounded-2xl p-5 space-y-3"
      >
        <h2 className="text-lg font-semibold text-amber">Unlock editing</h2>
        <p className="text-sm text-muted">
          Enter the production password to build the schedule, edit the lists, and confirm time off.
        </p>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className={btn.input}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !password} className={btn.primary}>
            {busy ? "…" : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}
