"use client";

import { useState, useEffect, useCallback } from "react";
import type { CatalogBeer } from "@/lib/inventory";
import type { Wine, WineCategory } from "@/lib/wine";
import type { MenuItem } from "@/lib/types";
import { beerNoteKey, type BeerNote } from "@/lib/beer-notes";
import type { ManualLink } from "@/lib/manuals";
import { BackToDashboard } from "@/components/BackToDashboard";

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

  // Wine list is loaded separately and saved in bulk. Each row is edited in
  // place; add/remove rows below.
  const [wines, setWines] = useState<Wine[]>([]);
  const [winesDirty, setWinesDirty] = useState(false);

  // Beer notes: menu items from Untappd + stored per-beer notes for override.
  // Each row is saved individually with its own button.
  const [beerItems, setBeerItems] = useState<MenuItem[]>([]);
  const [beerNotes, setBeerNotes] = useState<Record<string, BeerNote>>({});
  const [beerDrafts, setBeerDrafts] = useState<Record<string, string>>({});
  const [beerSaving, setBeerSaving] = useState<string | null>(null);

  // Help-page manual links, saved in bulk like the catalog.
  const [manuals, setManuals] = useState<ManualLink[]>([]);
  const [manualsDirty, setManualsDirty] = useState(false);
  const [newManualTitle, setNewManualTitle] = useState("");
  const [newManualUrl, setNewManualUrl] = useState("");
  const [newManualNote, setNewManualNote] = useState("");

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

      // Catalog + wines + beer notes are separate public endpoints; load
      // for admins only. Menu items come from /api/menu so we can list the
      // beers currently on tap in the notes editor.
      if ((data.role ?? "admin") === "admin") {
        try {
          const [catRes, wineRes, menuRes, notesRes, manualsRes] = await Promise.all([
            fetch("/api/inventory/catalog").then((r) => r.json()),
            fetch("/api/wines").then((r) => r.json()),
            fetch("/api/menu").then((r) => r.json()),
            fetch("/api/beer-notes", { method: "PUT" }).then((r) => r.json()),
            fetch("/api/manuals").then((r) => r.json()),
          ]);
          setCatalog(catRes.catalog || []);
          setCatalogDirty(false);
          setWines(wineRes.wines || []);
          setWinesDirty(false);
          setBeerItems(menuRes.menu?.items || []);
          setBeerNotes(notesRes.notes || {});
          setManuals(manualsRes.manuals || []);
          setManualsDirty(false);
        } catch {
          // non-fatal; leave lists empty
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
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <BackToDashboard />
          <h1 className="text-xl font-bold text-amber flex-1 min-w-0">
            {role === "editor" ? "Event Editor" : "Admin"}
          </h1>
          {role === "editor" && (
            <span className="text-xs text-muted border border-card-border rounded px-2 py-0.5 shrink-0">
              events only
            </span>
          )}
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

        {/* Wine List */}
        {role === "admin" && (
        <section className="bg-card-bg border border-card-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-1">
            Wine List
          </h2>
          <p className="text-xs text-muted mb-4">
            Shown at <a href="/wines" className="text-amber underline">/wines</a>
            . Prices are dollars (leave blank if the wine isn&apos;t sold that way).
          </p>

          {wines.length > 0 && (
            <div className="space-y-3 mb-4">
              {wines.map((w, i) => {
                const update = (patch: Partial<Wine>) => {
                  const next = [...wines];
                  next[i] = { ...w, ...patch };
                  setWines(next);
                  setWinesDirty(true);
                };
                return (
                  <div
                    key={w.id}
                    className="bg-surface rounded-lg border border-card-border p-3"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={w.name}
                        onChange={(e) => update({ name: e.target.value })}
                        placeholder="Name"
                        className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground col-span-2 font-medium"
                      />
                      <input
                        type="text"
                        value={w.producer || ""}
                        onChange={(e) => update({ producer: e.target.value || undefined })}
                        placeholder="Producer / winery"
                        className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground"
                      />
                      <select
                        value={w.category}
                        onChange={(e) => update({ category: e.target.value as WineCategory })}
                        className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground"
                      >
                        <option value="red">Red</option>
                        <option value="white">White</option>
                        <option value="rose">Rosé</option>
                        <option value="sparkling">Sparkling</option>
                        <option value="orange">Orange</option>
                        <option value="dessert">Dessert</option>
                      </select>
                      <input
                        type="text"
                        value={w.varietal || ""}
                        onChange={(e) => update({ varietal: e.target.value || undefined })}
                        placeholder="Varietal (Pinot Noir…)"
                        className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground"
                      />
                      <input
                        type="text"
                        value={w.region || ""}
                        onChange={(e) => update({ region: e.target.value || undefined })}
                        placeholder="Region"
                        className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground"
                      />
                      <input
                        type="text"
                        value={w.vintage || ""}
                        onChange={(e) => update({ vintage: e.target.value || undefined })}
                        placeholder="Vintage (2022 or NV)"
                        className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={w.abv ?? ""}
                        onChange={(e) =>
                          update({ abv: e.target.value === "" ? undefined : Number(e.target.value) })
                        }
                        placeholder="ABV %"
                        className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground"
                      />
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={w.glassPrice ?? ""}
                        onChange={(e) =>
                          update({ glassPrice: e.target.value === "" ? undefined : Number(e.target.value) })
                        }
                        placeholder="Glass $"
                        className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground"
                      />
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={w.bottlePrice ?? ""}
                        onChange={(e) =>
                          update({ bottlePrice: e.target.value === "" ? undefined : Number(e.target.value) })
                        }
                        placeholder="Bottle $"
                        className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground"
                      />
                      <textarea
                        value={w.notes || ""}
                        onChange={(e) => update({ notes: e.target.value || undefined })}
                        placeholder="Tasting notes / description (optional)"
                        rows={2}
                        className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground col-span-2"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setWines(wines.filter((_, j) => j !== i));
                        setWinesDirty(true);
                      }}
                      className="mt-2 text-red-400 text-xs hover:text-red-300"
                    >
                      Remove wine
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => {
              setWines([
                ...wines,
                {
                  id: `wine-${Date.now()}`,
                  name: "",
                  category: "red",
                },
              ]);
              setWinesDirty(true);
            }}
            className="bg-surface hover:bg-card-border text-foreground text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            + Add wine
          </button>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-card-border">
            <button
              onClick={async () => {
                // Drop blank rows before saving so accidental empties don't stick.
                const filtered = wines.filter((w) => w.name.trim() !== "");
                const res = await fetch("/api/wines", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": password,
                  },
                  body: JSON.stringify({ wines: filtered }),
                });
                const data = await res.json();
                if (res.ok) {
                  setWines(data.wines || filtered);
                  setWinesDirty(false);
                  flash("Wine list saved");
                } else {
                  flash(data.error || "Save failed");
                }
              }}
              disabled={!winesDirty}
              className="bg-amber text-background text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Wine List
            </button>
            {winesDirty && (
              <span className="text-xs text-copper">Unsaved changes</span>
            )}
          </div>
        </section>
        )}

        {/* Beer Notes */}
        {role === "admin" && (
        <section className="bg-card-bg border border-card-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-1">
            Beer Notes
          </h2>
          <p className="text-xs text-muted mb-4">
            House-written tasting notes shown on <a href="/beers" className="text-amber underline">/beers</a>.
            AI-generated notes fill in for beers you haven&apos;t written.
            A house note always wins. Clear the field and Save to fall
            back to AI.
          </p>

          {beerItems.length === 0 ? (
            <p className="text-sm text-muted">No beers loaded from Untappd yet.</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {beerItems.map((item) => {
                const key = beerNoteKey(item.name, item.brewery);
                const stored = beerNotes[key];
                const draft = beerDrafts[key] ?? stored?.tastingNotes ?? "";
                const dirty = draft !== (stored?.tastingNotes ?? "");
                return (
                  <div
                    key={key}
                    className="bg-surface rounded-lg border border-card-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-muted uppercase tracking-wider">
                          {[item.style, item.brewery].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      {stored && (
                        <span
                          className={`text-[10px] uppercase tracking-wider shrink-0 ${
                            stored.source === "manual" ? "text-amber" : "text-copper"
                          }`}
                        >
                          {stored.source === "manual" ? "House note" : "AI"}
                        </span>
                      )}
                    </div>
                    <textarea
                      value={draft}
                      onChange={(e) =>
                        setBeerDrafts({ ...beerDrafts, [key]: e.target.value })
                      }
                      rows={2}
                      placeholder="e.g. Bright grapefruit peel and pine, dry bitter finish."
                      className="w-full bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground"
                    />
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        disabled={!dirty || beerSaving === key}
                        onClick={async () => {
                          setBeerSaving(key);
                          try {
                            const res = await fetch("/api/beer-notes", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "x-admin-password": password,
                              },
                              body: JSON.stringify({
                                name: item.name,
                                brewery: item.brewery,
                                tastingNotes: draft,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) {
                              flash(data.error || "Save failed");
                              return;
                            }
                            const next = { ...beerNotes };
                            if (data.note) next[key] = data.note;
                            else delete next[key];
                            setBeerNotes(next);
                            const nextDrafts = { ...beerDrafts };
                            delete nextDrafts[key];
                            setBeerDrafts(nextDrafts);
                            flash(data.note ? "Note saved" : "Note cleared");
                          } finally {
                            setBeerSaving(null);
                          }
                        }}
                        className="bg-amber text-background text-xs font-medium px-3 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {beerSaving === key ? "Saving…" : "Save"}
                      </button>
                      {dirty && (
                        <span className="text-[10px] text-copper">unsaved</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {/* Help Manuals */}
        {role === "admin" && (
        <section className="bg-card-bg border border-card-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-1">
            Help Manuals
          </h2>
          <p className="text-xs text-muted mb-4">
            Links shown under Manuals &amp; Support on the{" "}
            <a href="/help" className="text-amber underline">/help</a> page
            (POS docs, equipment manuals, vendor support).
          </p>

          {manuals.length > 0 && (
            <div className="space-y-1 mb-4">
              {manuals.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between bg-surface rounded px-2 py-1.5 text-sm gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground">{m.title}</span>
                    {m.note && <span className="text-muted"> · {m.note}</span>}
                    <span className="block text-[10px] text-copper truncate">
                      {m.url}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setManuals(manuals.filter((x) => x.id !== m.id));
                      setManualsDirty(true);
                    }}
                    className="text-red-400 text-xs hover:text-red-300 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <input
              type="text"
              value={newManualTitle}
              onChange={(e) => setNewManualTitle(e.target.value)}
              placeholder="Title (e.g. Glycol Chiller Manual)"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
            <input
              type="url"
              value={newManualUrl}
              onChange={(e) => setNewManualUrl(e.target.value)}
              placeholder="https://..."
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
            <input
              type="text"
              value={newManualNote}
              onChange={(e) => setNewManualNote(e.target.value)}
              placeholder="Short note (optional)"
              className="bg-surface border border-card-border rounded px-2 py-1 text-sm text-foreground"
            />
          </div>
          <button
            onClick={() => {
              const title = newManualTitle.trim();
              const url = newManualUrl.trim();
              if (!title || !/^https?:\/\//i.test(url)) return;
              setManuals([
                ...manuals,
                {
                  id: `manual-${Date.now()}`,
                  title,
                  url,
                  note: newManualNote.trim() || undefined,
                },
              ]);
              setManualsDirty(true);
              setNewManualTitle("");
              setNewManualUrl("");
              setNewManualNote("");
            }}
            className="mt-2 bg-surface hover:bg-card-border text-foreground text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            Add manual
          </button>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-card-border">
            <button
              onClick={async () => {
                const res = await fetch("/api/manuals", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": password,
                  },
                  body: JSON.stringify({ manuals }),
                });
                const data = await res.json();
                if (res.ok) {
                  setManuals(data.manuals || manuals);
                  setManualsDirty(false);
                  flash("Manuals saved");
                } else {
                  flash(data.error || "Save failed");
                }
              }}
              disabled={!manualsDirty}
              className="bg-amber text-background text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Manuals
            </button>
            {manualsDirty && (
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
