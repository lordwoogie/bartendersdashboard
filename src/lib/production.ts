// Production schedule: the brewery's weekly whiteboard, moved out of the
// "Lively Production Week" spreadsheet so the floor can read it on a phone and
// the head brewer can build it without emailing a new file around.
//
// One document (production.json) holds everything the spreadsheet did:
//   - weeks:        the day-by-day grid (Canning/Packaging, Cellar, Prep,
//                   Brew, Help/Schedule, MIA), one entry per week
//   - needs:        the "NEEDS TO HAPPEN" lists (production / order / etc.)
//   - availability: confirmed time off and pending requests, per person
//   - crowder:      the Crowder packaging-materials reimbursement log
//   - runLog:       the canning run history ("6/19 - Smokiez Tropical - 5,000
//                   units - 200 cases")

export const TASK_COLUMNS = [
  { key: "packaging", label: "Canning / Packaging", short: "Canning" },
  { key: "cellar", label: "Cellar", short: "Cellar" },
  { key: "prep", label: "Prep / Warehouse", short: "Prep" },
  { key: "brew", label: "Brew", short: "Brew" },
] as const;

export const PEOPLE_COLUMNS = [
  { key: "help", label: "Help / Schedule", short: "Help" },
  { key: "mia", label: "MIA", short: "MIA" },
] as const;

export const ALL_COLUMNS = [...TASK_COLUMNS, ...PEOPLE_COLUMNS];

export type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];
export type TaskColumnKey = (typeof TASK_COLUMNS)[number]["key"];

export const COLUMN_KEYS: ColumnKey[] = ALL_COLUMNS.map((c) => c.key);
export const TASK_COLUMN_KEYS: TaskColumnKey[] = TASK_COLUMNS.map((c) => c.key);

export function isTaskColumn(key: ColumnKey): key is TaskColumnKey {
  return (TASK_COLUMN_KEYS as string[]).includes(key);
}

// The "TD" block at the top of the sheet: things to get done this week that
// aren't pinned to a day.
export const TODO_DAY = "todo";

export interface ProductionItem {
  id: string;
  day: string; // TODO_DAY or YYYY-MM-DD within the week
  column: ColumnKey;
  text: string;
  doneAt?: string; // ISO; task columns only
}

export interface ProductionWeek {
  weekStart: string; // Monday, YYYY-MM-DD
  items: ProductionItem[];
  dayNotes?: Record<string, string>; // date -> "Labor Day"
}

export type NeedGroup = "production" | "order" | "etc";
export const NEED_GROUPS: { key: NeedGroup; label: string }[] = [
  { key: "production", label: "Production" },
  { key: "order", label: "Order" },
  { key: "etc", label: "Etc." },
];

export interface NeedItem {
  id: string;
  group: NeedGroup;
  text: string;
  createdAt: string;
  doneAt?: string;
}

export type AvailabilityStatus = "confirmed" | "request";

export interface AvailabilityEntry {
  id: string;
  person: string;
  dates: string; // free text, e.g. "9/25 - 10/4" or "9/7, 9/11"
  status: AvailabilityStatus;
  note?: string;
  createdAt: string;
}

export interface Availability {
  people: string[];
  entries: AvailabilityEntry[];
}

export interface CrowderEntry {
  id: string;
  date: string; // YYYY-MM-DD
  item: string;
  reimbursed: boolean;
  reimbursedDate?: string;
  notes?: string;
}

export interface RunLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
}

export interface ProductionData {
  weeks: ProductionWeek[];
  needs: NeedItem[];
  availability: Availability;
  crowder: CrowderEntry[];
  runLog: RunLogEntry[];
}

// ---- Date helpers -------------------------------------------------------
//
// Everything is a YYYY-MM-DD calendar key. Arithmetic runs in UTC on those
// keys so the server (UTC) and a phone in Oklahoma agree on which Monday a
// date belongs to.

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Monday of the week containing `key`.
export function mondayOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(key, -((dow + 6) % 7));
}

// The seven days of a week, Monday first.
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function dayInWeek(weekStart: string, day: string): boolean {
  return weekDays(weekStart).includes(day);
}

function noon(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

// "Mon 8/31"
export function dayLabel(key: string): string {
  const d = noon(key);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(d);
  return `${wd} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function weekdayLong(key: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(noon(key));
}

// "Aug 31 – Sep 4" for the Monday–Friday span of a week, like the sheet header.
export function weekLabel(weekStart: string): string {
  const mon = noon(weekStart);
  const fri = noon(addDays(weekStart, 4));
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(d);
  return `${fmt(mon)} – ${fmt(fri)}`;
}

// "Jun 19, 2026"
export function longDate(key: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(noon(key));
}

// "6/19"
export function shortDate(key: string): string {
  const d = noon(key);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function emptyWeek(weekStart: string): ProductionWeek {
  return { weekStart, items: [] };
}

export function findWeek(data: ProductionData, weekStart: string): ProductionWeek | undefined {
  return data.weeks.find((w) => w.weekStart === weekStart);
}
