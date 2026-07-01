"use client";

import { useState, useEffect, useCallback } from "react";
import type { CatalogBeer } from "@/lib/inventory";

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
  endTime?: string;
  venue?: string;
  url?: string;
  description?: string;
}

type Role = "admin" | "editor";

interface AdminConfig {
  // For editors, the server returns a trimmed config containing only
  // manualEvents; the sports/email sections are never rendered for them, so
  // these fields are typed as present for the admin code paths that use them.
  sports: {
    leagues: Record<string, boolean>;
    favoriteTeams: string[];
  };
  emailRecipients: string[];
  manualEvents: ManualEvent[];
}

const EMPTY_EVENT = {
  name: "",
  date: "",
  time: "",
  endTime: "",
  venue: "",
  url: "",
  description: "",
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // New holiday form
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayEmoji, setNewHolidayEmoji] = useState("");
  const [newHolidayRecurring, setNewHolidayRecurring] = useState(true);

  // Event details form — used for both adding a new event and editing an
  // existing one. `editingId` is null when adding, or the event id when editing.
  const [eventForm, setEventForm] = useState(EMPTY_EVENT);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New recipient
  const [newEmail, setNewEmail] = useState("");

  // New favorite team
  const [newTeam, setNewTeam] = useState("");

  // TV settings are staged locally and persisted via the Save button.
  const [tvDirty, setTvDirty] = useState(false);

  // Inventory catalog is loaded separately and saved in bulk.
  const [catalog, setCatalog] = useState<CatalogBeer[]>([]);
  const [catalogDirty, setCatalogDirty] = useState(false);
  const [newBeerName, setNewBeerName] = useState("");
  const [newBeerBrewery, setNewBeerBrewery] = useState("");
  const [newBeerFormat, setNewBeerFormat] = useState<CatalogBeer["format"]>("keg");

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
      setHolidays(data.holidays || []);
      setRole(data.role ?? "admin");
      setTvDirty(false);
      setAuthenticated(true);
      setMessage("");

      // Catalog is a separate public endpoint; load it for admins only.
      if ((data.role ?? "admin") === "admin") {
        try {
          const catRes = await fetch("/api/inventory/catalog");
          const catData = await catRes.json();
          setCatalog(catData.catalog || []);
          setCatalogDirty(false);
        } catch {
          // non-fatal; leave catalog empty
        }
      }
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
          <h1 className="text-xl font-bold text-amber">
            {role === "editor" ? "Event Editor" : "Admin"}
          </h1>
          <div className="flex items-center gap-3">
            {role === "editor" && (
              <span className="text-xs text-muted border border-card-border rounded px-2 py-0.5">
                events only
              </span>
            )}
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
        {role === "admin" && (
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
        )}

        {/* TV Priority / Leagues */}
        {role === "admin" && config && (
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
                    onChange={() => {
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
                      setTvDirty(true);
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
                    onClick={() => {
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
                      setTvDirty(true);
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
                onClick={() => {
                  if (!newTeam) return;
                  const updated = {
                    ...config,
                    sports: {
                      ...config.sports,
                      favoriteTeams: [...config.sports.favoriteTeams, newTeam],
                    },
                  };
                  setConfig(updated);
                  setTvDirty(true);
                  setNewTeam("");
                }}
                className="bg-amber text-background text-sm px-3 py-1 rounded"
              >
                Add
              </button>
            </div>

            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-card-border">
              <button
                onClick={async () => {
                  await adminPost({ action: "update-config", config });
                  setTvDirty(false);
                  flash("TV settings saved");
                }}
                disabled={!tvDirty}
                className="bg-amber text-background text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save TV Settings
              </button>
              {tvDirty && (
                <span className="text-xs text-copper">Unsaved changes</span>
              )}
            </div>
          </section>
        )}

        {/* Email Recipients */}
        {role === "admin" && config && (
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

        {/* Event Details */}
        <section className="bg-card-bg border border-card-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-1">
            Event Details
          </h2>
          <p className="text-xs text-muted mb-4">
            Add or edit events that appear on the dashboard.
          </p>
          {config?.manualEvents && config.manualEvents.length > 0 && (
            <div className="space-y-2 mb-4">
              {config.manualEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-surface rounded-lg px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-foreground">
                        {evt.name}
                      </div>
                      <div className="text-xs text-muted">
                        {evt.date}
                        {evt.time ? ` · ${evt.time}` : ""}
                        {evt.endTime ? `–${evt.endTime}` : ""}
                        {evt.venue ? ` · ${evt.venue}` : ""}
                      </div>
                      {evt.description && (
                        <div className="text-xs text-muted mt-1">
                          {evt.description}
                        </div>
                      )}
                      {evt.url && (
                        <a
                          href={evt.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-copper hover:text-amber break-all"
                        >
                          {evt.url}
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingId(evt.id);
                          setEventForm({
                            name: evt.name,
                            date: evt.date,
                            time: evt.time === "TBD" ? "" : evt.time,
                            endTime: evt.endTime || "",
                            venue: evt.venue || "",
                            url: evt.url || "",
                            description: evt.description || "",
                          });
                        }}
                        className="text-copper text-xs hover:text-amber"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          const result = await adminPost({
                            action: "remove-manual-event",
                            eventId: evt.id,
                          });
                          if (result.config) setConfig(result.config);
                          if (editingId === evt.id) {
                            setEditingId(null);
                            setEventForm(EMPTY_EVENT);
                          }
                          flash("Event removed");
                        }}
                        className="text-red-400 text-xs hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-sm font-semibold text-copper mb-2">
            {editingId ? "Edit Event" : "Add Event"}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={eventForm.name}
              onChange={(e) =>
                setEventForm({ ...eventForm, name: e.target.value })
              }
              placeholder="Event name"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground col-span-2"
            />
            <input
              type="date"
              value={eventForm.date}
              onChange={(e) =>
                setEventForm({ ...eventForm, date: e.target.value })
              }
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
            <input
              type="time"
              value={eventForm.time}
              onChange={(e) =>
                setEventForm({ ...eventForm, time: e.target.value })
              }
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
            <label className="text-xs text-muted flex flex-col gap-1">
              End time (optional)
              <input
                type="time"
                value={eventForm.endTime}
                onChange={(e) =>
                  setEventForm({ ...eventForm, endTime: e.target.value })
                }
                className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
              />
            </label>
            <input
              type="text"
              value={eventForm.venue}
              onChange={(e) =>
                setEventForm({ ...eventForm, venue: e.target.value })
              }
              placeholder="Venue / location (optional)"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground self-end"
            />
            <input
              type="url"
              value={eventForm.url}
              onChange={(e) =>
                setEventForm({ ...eventForm, url: e.target.value })
              }
              placeholder="Link / tickets URL (optional)"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground col-span-2"
            />
            <textarea
              value={eventForm.description}
              onChange={(e) =>
                setEventForm({ ...eventForm, description: e.target.value })
              }
              placeholder="Description (optional)"
              rows={2}
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground col-span-2"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={async () => {
                if (!eventForm.name || !eventForm.date) return;
                const event = {
                  name: eventForm.name,
                  date: eventForm.date,
                  time: eventForm.time || "TBD",
                  endTime: eventForm.endTime || undefined,
                  venue: eventForm.venue || undefined,
                  url: eventForm.url || undefined,
                  description: eventForm.description || undefined,
                };
                const result = await adminPost(
                  editingId
                    ? {
                        action: "update-manual-event",
                        eventId: editingId,
                        event,
                      }
                    : { action: "add-manual-event", event }
                );
                if (result.config) setConfig(result.config);
                const wasEditing = editingId !== null;
                setEventForm(EMPTY_EVENT);
                setEditingId(null);
                flash(wasEditing ? "Event updated" : "Event added");
              }}
              className="bg-amber text-background text-sm font-medium px-4 py-1.5 rounded-lg"
            >
              {editingId ? "Save Changes" : "Add Event"}
            </button>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setEventForm(EMPTY_EVENT);
                }}
                className="bg-surface text-foreground text-sm px-4 py-1.5 rounded-lg hover:bg-card-border transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </section>

        {/* Inventory Catalog */}
        {role === "admin" && (
        <section className="bg-card-bg border border-card-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-1">
            Inventory Catalog
          </h2>
          <p className="text-xs text-muted mb-4">
            Beers/cans that appear in the /inventory picker. Bartenders can
            still type in a beer that&apos;s not on this list.
          </p>

          {catalog.length > 0 && (
            <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
              {catalog.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between bg-surface rounded px-2 py-1.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground">{b.name}</span>
                    {b.brewery && (
                      <span className="text-muted"> · {b.brewery}</span>
                    )}
                    <span className="text-xs text-copper ml-2 uppercase">
                      {b.format}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setCatalog(catalog.filter((x) => x.id !== b.id));
                      setCatalogDirty(true);
                    }}
                    className="text-red-400 text-xs hover:text-red-300 shrink-0"
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
              value={newBeerName}
              onChange={(e) => setNewBeerName(e.target.value)}
              placeholder="Beer name"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground col-span-2"
            />
            <input
              type="text"
              value={newBeerBrewery}
              onChange={(e) => setNewBeerBrewery(e.target.value)}
              placeholder="Brewery (optional)"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
            <select
              value={newBeerFormat}
              onChange={(e) =>
                setNewBeerFormat(e.target.value as CatalogBeer["format"])
              }
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            >
              <option value="keg">Keg</option>
              <option value="can">Can</option>
              <option value="bottle">Bottle</option>
            </select>
          </div>
          <button
            onClick={() => {
              const name = newBeerName.trim();
              if (!name) return;
              setCatalog([
                ...catalog,
                {
                  id: `beer-${Date.now()}`,
                  name,
                  brewery: newBeerBrewery.trim() || undefined,
                  format: newBeerFormat,
                },
              ]);
              setCatalogDirty(true);
              setNewBeerName("");
              setNewBeerBrewery("");
            }}
            className="mt-2 bg-surface hover:bg-card-border text-foreground text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            Add to catalog
          </button>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-card-border">
            <button
              onClick={async () => {
                const res = await fetch("/api/inventory/catalog", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": password,
                  },
                  body: JSON.stringify({ catalog }),
                });
                const data = await res.json();
                if (res.ok) {
                  setCatalog(data.catalog || catalog);
                  setCatalogDirty(false);
                  flash("Catalog saved");
                } else {
                  flash(data.error || "Save failed");
                }
              }}
              disabled={!catalogDirty}
              className="bg-amber text-background text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Catalog
            </button>
            {catalogDirty && (
              <span className="text-xs text-copper">Unsaved changes</span>
            )}
          </div>
        </section>
        )}

        {/* Preview & Test */}
        {role === "admin" && (
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
        )}
      </main>
    </div>
  );
}
