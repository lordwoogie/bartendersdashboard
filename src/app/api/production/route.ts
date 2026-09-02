import { NextResponse } from "next/server";
import { readData, mutateData } from "@/lib/storage";
import {
  COLUMN_KEYS,
  TODO_DAY,
  dayInWeek,
  isDateKey,
  isTaskColumn,
  mondayOf,
  type AvailabilityEntry,
  type AvailabilityStatus,
  type ColumnKey,
  type CrowderEntry,
  type NeedGroup,
  type NeedItem,
  type ProductionData,
  type ProductionItem,
  type ProductionWeek,
  type RunLogEntry,
} from "@/lib/production";

// Production schedule API. Reads are open to everyone on the floor. Two kinds
// of writes exist:
//   - open:      checking a task off, and adding a time-off *request*
//                (the sheet said "add dates you'll be gone to the request
//                column"; the head brewer moves them to confirmed)
//   - protected: everything else — building the week, editing needs, logs,
//                confirming time off. Requires PRODUCTION_PASSWORD (or the
//                admin password) in the x-admin-password header, same
//                mechanism the rest of the app uses.

const DOC = "production.json";
const MAX_TEXT = 300;
const MAX_ITEMS_PER_WEEK = 400;
const MAX_LIST = 2000;

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

const OPEN_ACTIONS = new Set(["toggle-item", "toggle-need", "add-availability-request"]);

function canEdit(request: Request): boolean {
  const auth = request.headers.get("x-admin-password");
  if (!auth) return false;
  const production = process.env.PRODUCTION_PASSWORD;
  const admin = process.env.ADMIN_PASSWORD;
  return Boolean((production && auth === production) || (admin && auth === admin));
}

class ActionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function bad(message: string): never {
  throw new ActionError(400, message);
}

function notFound(what: string): never {
  throw new ActionError(404, `${what} not found`);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36).padStart(4, "0")}`;
}

// Required non-empty string, trimmed and length-capped.
function text(value: unknown, field: string, max = MAX_TEXT): string {
  const t = typeof value === "string" ? value.trim() : "";
  if (!t) bad(`${field} is required`);
  if (t.length > max) bad(`${field} is too long`);
  return t;
}

// Optional string: undefined when blank so we don't persist empty fields.
function optText(value: unknown, field: string, max = MAX_TEXT): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") bad(`${field} must be text`);
  const t = value.trim();
  if (t.length > max) bad(`${field} is too long`);
  return t || undefined;
}

function dateKey(value: unknown, field: string): string {
  if (!isDateKey(value)) bad(`${field} must be a YYYY-MM-DD date`);
  return value;
}

function weekStartOf(value: unknown): string {
  const key = dateKey(value, "weekStart");
  if (mondayOf(key) !== key) bad("weekStart must be a Monday");
  return key;
}

function columnOf(value: unknown): ColumnKey {
  if (typeof value !== "string" || !(COLUMN_KEYS as string[]).includes(value)) {
    bad(`column must be one of ${COLUMN_KEYS.join(", ")}`);
  }
  return value as ColumnKey;
}

function groupOf(value: unknown): NeedGroup {
  if (value !== "production" && value !== "order" && value !== "etc") {
    bad("group must be production, order, or etc");
  }
  return value;
}

function statusOf(value: unknown): AvailabilityStatus {
  if (value !== "confirmed" && value !== "request") bad("status must be confirmed or request");
  return value;
}

function idOf(value: unknown): string {
  if (typeof value !== "string" || !value) bad("id is required");
  return value;
}

// Replace (or create) one week inside the document, keeping weeks ordered.
function withWeek(
  data: ProductionData,
  weekStart: string,
  fn: (week: ProductionWeek) => ProductionWeek
): ProductionData {
  const existing = data.weeks.find((w) => w.weekStart === weekStart);
  const next = fn(existing ?? { weekStart, items: [] });
  const weeks = data.weeks.filter((w) => w.weekStart !== weekStart).concat(next);
  weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return { ...data, weeks };
}

function replaceById<T extends { id: string }>(list: T[], id: string, what: string, fn: (item: T) => T): T[] {
  const idx = list.findIndex((i) => i.id === id);
  if (idx === -1) notFound(what);
  const next = [...list];
  next[idx] = fn(next[idx]);
  return next;
}

function removeById<T extends { id: string }>(list: T[], id: string, what: string): T[] {
  const next = list.filter((i) => i.id !== id);
  if (next.length === list.length) notFound(what);
  return next;
}

function capped<T>(list: T[], max: number, what: string): T[] {
  if (list.length > max) bad(`Too many ${what} — remove some first`);
  return list;
}

type Body = Record<string, unknown>;

// Every action is a pure function of (current doc, body) so mutateData can
// re-run it under write contention.
function applyAction(data: ProductionData, body: Body): ProductionData {
  const action = body.action;
  switch (action) {
    // ---- Week grid -------------------------------------------------------
    case "add-item": {
      const weekStart = weekStartOf(body.weekStart);
      const day = body.day === TODO_DAY ? TODO_DAY : dateKey(body.day, "day");
      if (day !== TODO_DAY && !dayInWeek(weekStart, day)) bad("day is not in that week");
      const column = columnOf(body.column);
      if (day === TODO_DAY && !isTaskColumn(column)) bad("To-do items go in a task column");
      const item: ProductionItem = { id: newId("pi"), day, column, text: text(body.text, "text") };
      return withWeek(data, weekStart, (w) => ({
        ...w,
        items: capped([...w.items, item], MAX_ITEMS_PER_WEEK, "items this week"),
      }));
    }
    case "update-item": {
      const weekStart = weekStartOf(body.weekStart);
      const id = idOf(body.id);
      const t = text(body.text, "text");
      return withWeek(data, weekStart, (w) => ({
        ...w,
        items: replaceById(w.items, id, "Item", (i) => ({ ...i, text: t })),
      }));
    }
    case "toggle-item": {
      const weekStart = weekStartOf(body.weekStart);
      const id = idOf(body.id);
      return withWeek(data, weekStart, (w) => ({
        ...w,
        items: replaceById(w.items, id, "Item", (i) => {
          if (!isTaskColumn(i.column)) bad("Only tasks can be checked off");
          const next = { ...i };
          if (next.doneAt) delete next.doneAt;
          else next.doneAt = new Date().toISOString();
          return next;
        }),
      }));
    }
    case "remove-item": {
      const weekStart = weekStartOf(body.weekStart);
      const id = idOf(body.id);
      return withWeek(data, weekStart, (w) => ({ ...w, items: removeById(w.items, id, "Item") }));
    }
    case "move-item": {
      // Reorder within the same cell (day + column). Items in other cells are
      // untouched; only the relative order among cell-mates changes.
      const weekStart = weekStartOf(body.weekStart);
      const id = idOf(body.id);
      const direction = body.direction === -1 || body.direction === 1 ? body.direction : bad("direction must be -1 or 1");
      return withWeek(data, weekStart, (w) => {
        const idx = w.items.findIndex((i) => i.id === id);
        if (idx === -1) notFound("Item");
        const me = w.items[idx];
        const mates = w.items
          .map((i, at) => ({ i, at }))
          .filter(({ i }) => i.day === me.day && i.column === me.column);
        const pos = mates.findIndex(({ at }) => at === idx);
        const swapWith = mates[pos + direction];
        if (!swapWith) return w; // already at the edge
        const items = [...w.items];
        items[idx] = swapWith.i;
        items[swapWith.at] = me;
        return { ...w, items };
      });
    }
    case "set-day-note": {
      const weekStart = weekStartOf(body.weekStart);
      const day = dateKey(body.day, "day");
      if (!dayInWeek(weekStart, day)) bad("day is not in that week");
      const note = optText(body.note, "note", 120);
      return withWeek(data, weekStart, (w) => {
        const dayNotes = { ...(w.dayNotes ?? {}) };
        if (note) dayNotes[day] = note;
        else delete dayNotes[day];
        const next: ProductionWeek = { ...w, dayNotes };
        if (Object.keys(dayNotes).length === 0) delete next.dayNotes;
        return next;
      });
    }
    case "copy-week": {
      // Seed an empty week from another one: same items, shifted to the
      // matching weekday, nothing checked off. Refuses to merge into a week
      // that already has content so a mis-tap can't duplicate everything.
      const from = weekStartOf(body.from);
      const to = weekStartOf(body.to);
      if (from === to) bad("Pick a different week to copy from");
      const source = data.weeks.find((w) => w.weekStart === from);
      if (!source || source.items.length === 0) bad("That week is empty");
      const target = data.weeks.find((w) => w.weekStart === to);
      if (target && target.items.length > 0) bad("This week already has items");
      const shift = (day: string) => {
        if (day === TODO_DAY) return day;
        const offset = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
        return new Date(Date.parse(`${to}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
      };
      return withWeek(data, to, () => ({
        weekStart: to,
        items: source.items.map((i) => ({ id: newId("pi"), day: shift(i.day), column: i.column, text: i.text })),
      }));
    }

    // ---- Needs to happen -------------------------------------------------
    case "add-need": {
      const item: NeedItem = {
        id: newId("need"),
        group: groupOf(body.group),
        text: text(body.text, "text"),
        createdAt: new Date().toISOString(),
      };
      return { ...data, needs: capped([...data.needs, item], MAX_LIST, "needs") };
    }
    case "update-need": {
      const id = idOf(body.id);
      const t = text(body.text, "text");
      const group = body.group === undefined ? undefined : groupOf(body.group);
      return {
        ...data,
        needs: replaceById(data.needs, id, "Need", (n) => ({ ...n, text: t, group: group ?? n.group })),
      };
    }
    case "toggle-need": {
      const id = idOf(body.id);
      return {
        ...data,
        needs: replaceById(data.needs, id, "Need", (n) => {
          const next = { ...n };
          if (next.doneAt) delete next.doneAt;
          else next.doneAt = new Date().toISOString();
          return next;
        }),
      };
    }
    case "remove-need":
      return { ...data, needs: removeById(data.needs, idOf(body.id), "Need") };

    // ---- Availability ----------------------------------------------------
    case "add-availability":
    case "add-availability-request": {
      const entry: AvailabilityEntry = {
        id: newId("av"),
        person: text(body.person, "person", 60),
        dates: text(body.dates, "dates", 120),
        status: action === "add-availability-request" ? "request" : statusOf(body.status ?? "confirmed"),
        createdAt: new Date().toISOString(),
      };
      const note = optText(body.note, "note");
      if (note) entry.note = note;
      const people = data.availability.people.includes(entry.person)
        ? data.availability.people
        : [...data.availability.people, entry.person];
      return {
        ...data,
        availability: {
          people,
          entries: capped([...data.availability.entries, entry], MAX_LIST, "availability entries"),
        },
      };
    }
    case "update-availability": {
      const id = idOf(body.id);
      return {
        ...data,
        availability: {
          ...data.availability,
          entries: replaceById(data.availability.entries, id, "Entry", (e) => {
            const next = { ...e };
            if (body.person !== undefined) next.person = text(body.person, "person", 60);
            if (body.dates !== undefined) next.dates = text(body.dates, "dates", 120);
            if (body.status !== undefined) next.status = statusOf(body.status);
            if (body.note !== undefined) {
              const note = optText(body.note, "note");
              if (note) next.note = note;
              else delete next.note;
            }
            return next;
          }),
        },
      };
    }
    case "remove-availability":
      return {
        ...data,
        availability: {
          ...data.availability,
          entries: removeById(data.availability.entries, idOf(body.id), "Entry"),
        },
      };
    case "add-person": {
      const name = text(body.name, "name", 60);
      if (data.availability.people.some((p) => p.toLowerCase() === name.toLowerCase())) return data;
      return {
        ...data,
        availability: { ...data.availability, people: [...data.availability.people, name] },
      };
    }
    case "remove-person": {
      const name = text(body.name, "name", 60);
      return {
        ...data,
        availability: {
          ...data.availability,
          people: data.availability.people.filter((p) => p !== name),
        },
      };
    }

    // ---- Crowder inventory / reimbursement log ---------------------------
    case "add-crowder": {
      const entry: CrowderEntry = {
        id: newId("cr"),
        date: dateKey(body.date, "date"),
        item: text(body.item, "item"),
        reimbursed: body.reimbursed === true,
      };
      if (body.reimbursedDate) entry.reimbursedDate = dateKey(body.reimbursedDate, "reimbursedDate");
      const notes = optText(body.notes, "notes");
      if (notes) entry.notes = notes;
      return { ...data, crowder: capped([...data.crowder, entry], MAX_LIST, "log entries") };
    }
    case "update-crowder": {
      const id = idOf(body.id);
      return {
        ...data,
        crowder: replaceById(data.crowder, id, "Entry", (e) => {
          const next = { ...e };
          if (body.date !== undefined) next.date = dateKey(body.date, "date");
          if (body.item !== undefined) next.item = text(body.item, "item");
          if (body.reimbursed !== undefined) next.reimbursed = body.reimbursed === true;
          if (body.reimbursedDate !== undefined) {
            if (body.reimbursedDate) next.reimbursedDate = dateKey(body.reimbursedDate, "reimbursedDate");
            else delete next.reimbursedDate;
          }
          if (body.notes !== undefined) {
            const notes = optText(body.notes, "notes");
            if (notes) next.notes = notes;
            else delete next.notes;
          }
          return next;
        }),
      };
    }
    case "remove-crowder":
      return { ...data, crowder: removeById(data.crowder, idOf(body.id), "Entry") };

    // ---- Canning run log -------------------------------------------------
    case "add-run": {
      const entry: RunLogEntry = {
        id: newId("run"),
        date: dateKey(body.date, "date"),
        text: text(body.text, "text"),
      };
      return { ...data, runLog: capped([...data.runLog, entry], MAX_LIST, "run log entries") };
    }
    case "update-run": {
      const id = idOf(body.id);
      return {
        ...data,
        runLog: replaceById(data.runLog, id, "Entry", (e) => ({
          ...e,
          date: body.date !== undefined ? dateKey(body.date, "date") : e.date,
          text: body.text !== undefined ? text(body.text, "text") : e.text,
        })),
      };
    }
    case "remove-run":
      return { ...data, runLog: removeById(data.runLog, idOf(body.id), "Entry") };

    default:
      bad("Unknown action");
  }
}

// GET /api/production — the whole document plus whether the caller's
// password unlocks editing (so the page can restore a saved login).
export async function GET(request: Request) {
  try {
    const data = await readData<ProductionData>(DOC);
    return NextResponse.json({ data, canEdit: canEdit(request) }, { headers: NO_STORE });
  } catch (err) {
    console.error("Production GET error:", err);
    return NextResponse.json({ error: "Failed to load production data" }, { status: 500 });
  }
}

// POST /api/production — { action, ...fields }. Returns the updated document.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object" || typeof body.action !== "string") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!OPEN_ACTIONS.has(body.action) && !canEdit(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await mutateData<ProductionData>(DOC, (current) => applyAction(current, body));
    return NextResponse.json({ success: true, data }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof ActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Production POST error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
