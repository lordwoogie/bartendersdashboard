"use client";

import { useState, useEffect, useCallback } from "react";

interface Holiday {
  date: string;
  name: string;
  emoji?: string;
  recurring?: boolean;
}

interface ManualEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  description?: string;
}

interface AdminConfig {
  sports: {
    leagues: Record<string, boolean>;
    favoriteTeams: string[];
  };
  emailRecipients: string[];
  manualEvents: ManualEvent[];
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // New holiday form
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayEmoji, setNewHolidayEmoji] = useState("");
  const [newHolidayRecurring, setNewHolidayRecurring] = useState(true);

  // New event form
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventTime, setNewEventTime] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");

  // New recipient
  const [newEmail, setNewEmail] = useState("");

  // New favorite team
  const [newTeam, setNewTeam] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) {
        setAuthenticated(false);
        setMessage("Invalid password");
        return;
      }
      const data = await res.json();
      setConfig(data.config);
      setHolidays(data.holidays);
      setAuthenticated(true);
      setMessage("");
    } catch {
      setMessage("Failed to load config");
    } finally {
      setLoading(false);
    }
  }, [password]);

  const adminPost = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card-bg border border-card-border rounded-xl p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-amber mb-4">Admin Login</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchConfig()}
            placeholder="Password"
            className="w-full bg-surface border border-card-border rounded-lg px-3 py-2 text-foreground mb-3"
          />
          <button
            onClick={fetchConfig}
            disabled={loading}
            className="w-full bg-amber text-background font-semibold py-2 rounded-lg hover:bg-copper transition-colors"
          >
            {loading ? "..." : "Login"}
          </button>
          {message && <p className="text-red-400 text-sm mt-2">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card-bg border-b border-card-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-amber">Admin</h1>
          <div className="flex gap-3">
            <a href="/" className="text-sm text-muted hover:text-foreground">
              Dashboard
            </a>
          </div>
        </div>
      </header>

      {message && (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <div className="bg-amber/20 text-amber text-sm px-4 py-2 rounded-lg">
            {message}
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Custom Holidays */}
        <section className="bg-card-bg border border-card-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-4">
            Custom Holidays & Observances
          </h2>
          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {holidays.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-sm"
              >
                <span>
                  {h.emoji} {h.name} — {h.date}
                  {h.recurring && (
                    <span className="text-xs text-muted ml-2">(yearly)</span>
                  )}
                </span>
                <button
                  onClick={async () => {
                    await adminPost({
                      action: "remove-holiday",
                      date: h.date,
                      name: h.name,
                    });
                    setHolidays(holidays.filter((_, j) => j !== i));
                    flash("Holiday removed");
                  }}
                  className="text-red-400 text-xs hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              placeholder="MM-DD"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
            <input
              type="text"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              placeholder="Name"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
            <input
              type="text"
              value={newHolidayEmoji}
              onChange={(e) => setNewHolidayEmoji(e.target.value)}
              placeholder="Emoji"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={newHolidayRecurring}
                onChange={(e) => setNewHolidayRecurring(e.target.checked)}
              />
              Recurring yearly
            </label>
          </div>
          <button
            onClick={async () => {
              if (!newHolidayDate || !newHolidayName) return;
              const holiday = {
                date: newHolidayDate,
                name: newHolidayName,
                emoji: newHolidayEmoji || undefined,
                recurring: newHolidayRecurring,
              };
              await adminPost({ action: "add-holiday", holiday });
              setHolidays([...holidays, holiday]);
              setNewHolidayDate("");
              setNewHolidayName("");
              setNewHolidayEmoji("");
              flash("Holiday added");
            }}
            className="mt-2 bg-amber text-background text-sm font-medium px-4 py-1.5 rounded-lg"
          >
            Add Holiday
          </button>
        </section>

        {/* TV Priority / Leagues */}
        {config && (
          <section className="bg-card-bg border border-card-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-amber mb-4">
              TV Sports Settings
            </h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.entries(config.sports.leagues).map(([league, enabled]) => (
                <label key={league} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={async () => {
                      const updated = {
                        ...config,
                        sports: {
                          ...config.sports,
                          leagues: {
                            ...config.sports.leagues,
                            [league]: !enabled,
                          },
                        },
                      };
                      setConfig(updated);
                      await adminPost({
                        action: "update-config",
                        config: updated,
                      });
                    }}
                  />
                  {league.toUpperCase()}
                </label>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-copper mb-2">
              Favorite Teams (Always Show)
            </h3>
            <div className="space-y-1 mb-2">
              {config.sports.favoriteTeams.map((team, i) => (
                <div key={i} className="flex items-center justify-between bg-surface rounded px-2 py-1 text-sm">
                  <span>{team}</span>
                  <button
                    onClick={async () => {
                      const updated = {
                        ...config,
                        sports: {
                          ...config.sports,
                          favoriteTeams: config.sports.favoriteTeams.filter(
                            (_, j) => j !== i
                          ),
                        },
                      };
                      setConfig(updated);
                      await adminPost({
                        action: "update-config",
                        config: updated,
                      });
                    }}
                    className="text-red-400 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value)}
                placeholder="Team name"
                className="flex-1 bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
              />
              <button
                onClick={async () => {
                  if (!newTeam) return;
                  const updated = {
                    ...config,
                    sports: {
                      ...config.sports,
                      favoriteTeams: [...config.sports.favoriteTeams, newTeam],
                    },
                  };
                  setConfig(updated);
                  await adminPost({ action: "update-config", config: updated });
                  setNewTeam("");
                }}
                className="bg-amber text-background text-sm px-3 py-1 rounded"
              >
                Add
              </button>
            </div>
          </section>
        )}

        {/* Email Recipients */}
        {config && (
          <section className="bg-card-bg border border-card-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-amber mb-4">
              Email Recipients
            </h2>
            <div className="space-y-1 mb-2">
              {config.emailRecipients.map((email, i) => (
                <div key={i} className="flex items-center justify-between bg-surface rounded px-2 py-1 text-sm">
                  <span>{email}</span>
                  <button
                    onClick={async () => {
                      const updated = config.emailRecipients.filter(
                        (_, j) => j !== i
                      );
                      setConfig({ ...config, emailRecipients: updated });
                      await adminPost({
                        action: "update-recipients",
                        recipients: updated,
                      });
                    }}
                    className="text-red-400 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
              />
              <button
                onClick={async () => {
                  if (!newEmail) return;
                  const updated = [...config.emailRecipients, newEmail];
                  setConfig({ ...config, emailRecipients: updated });
                  await adminPost({
                    action: "update-recipients",
                    recipients: updated,
                  });
                  setNewEmail("");
                  flash("Recipient added");
                }}
                className="bg-amber text-background text-sm px-3 py-1 rounded"
              >
                Add
              </button>
            </div>
          </section>
        )}

        {/* Manual Event Add */}
        <section className="bg-card-bg border border-card-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-4">
            Quick Add Event
          </h2>
          {config?.manualEvents && config.manualEvents.length > 0 && (
            <div className="space-y-1 mb-4">
              {config.manualEvents.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between bg-surface rounded px-2 py-1 text-sm">
                  <span>
                    {evt.name} — {evt.date} {evt.time}
                  </span>
                  <button
                    onClick={async () => {
                      await adminPost({
                        action: "remove-manual-event",
                        eventId: evt.id,
                      });
                      setConfig({
                        ...config!,
                        manualEvents: config!.manualEvents.filter(
                          (e) => e.id !== evt.id
                        ),
                      });
                      flash("Event removed");
                    }}
                    className="text-red-400 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              placeholder="Event name"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground col-span-2"
            />
            <input
              type="date"
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
            <input
              type="time"
              value={newEventTime}
              onChange={(e) => setNewEventTime(e.target.value)}
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
            <input
              type="text"
              value={newEventDesc}
              onChange={(e) => setNewEventDesc(e.target.value)}
              placeholder="Description (optional)"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground col-span-2"
            />
          </div>
          <button
            onClick={async () => {
              if (!newEventName || !newEventDate) return;
              const event = {
                name: newEventName,
                date: newEventDate,
                time: newEventTime || "TBD",
                description: newEventDesc || undefined,
              };
              const result = await adminPost({
                action: "add-manual-event",
                event,
              });
              if (result.config) setConfig(result.config);
              setNewEventName("");
              setNewEventDate("");
              setNewEventTime("");
              setNewEventDesc("");
              flash("Event added");
            }}
            className="mt-2 bg-amber text-background text-sm font-medium px-4 py-1.5 rounded-lg"
          >
            Add Event
          </button>
        </section>

        {/* Preview & Test */}
        <section className="bg-card-bg border border-card-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-4">
            Email Preview & Test
          </h2>
          <div className="flex gap-3">
            <a
              href="/api/send-briefing/preview"
              target="_blank"
              className="bg-surface hover:bg-card-border text-foreground text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Preview Email
            </a>
            <button
              onClick={async () => {
                const email = prompt("Send test email to:");
                if (!email) return;
                const res = await fetch("/api/send-briefing", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ testEmail: email }),
                });
                if (res.ok) {
                  flash("Test email sent!");
                } else {
                  flash("Failed to send test email");
                }
              }}
              className="bg-copper hover:bg-amber text-background text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Send Test Email
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
