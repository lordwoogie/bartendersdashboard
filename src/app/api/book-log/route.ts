import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/storage";

const DOC = "book-log.json";
const MAX_ENTRIES = 400; // ~13 months of daily completions

// One record per calendar day the book was fully completed.
interface BookLogEntry {
  date: string; // YYYY-MM-DD (venue-local day, sent by the client)
  day: string; // "monday" ... "sunday"
  completedAt: string; // ISO instant the last box was checked
  itemCount: number;
}

// GET /api/book-log?limit=30 — most recent first.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = parseInt(searchParams.get("limit") || "30", 10);
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(raw, MAX_ENTRIES)) : 30;

  const log = await readData<BookLogEntry[]>(DOC);
  const sorted = [...log].sort((a, b) => (a.date < b.date ? 1 : -1));
  return NextResponse.json({ entries: sorted.slice(0, limit) });
}

// POST /api/book-log { date, day, itemCount } — upsert by date. Re-posting
// the same day (e.g. a box was unchecked and rechecked) just refreshes
// completedAt, so duplicate fires are harmless.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { date, day, itemCount } = body as Record<string, unknown>;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) is required" }, { status: 400 });
  }
  if (typeof day !== "string" || !day) {
    return NextResponse.json({ error: "day is required" }, { status: 400 });
  }
  const count = typeof itemCount === "number" && Number.isFinite(itemCount) ? itemCount : 0;

  const entry: BookLogEntry = {
    date,
    day,
    completedAt: new Date().toISOString(),
    itemCount: count,
  };

  const log = await readData<BookLogEntry[]>(DOC);
  const next = log.filter((e) => e.date !== date);
  next.push(entry);
  const trimmed =
    next.length > MAX_ENTRIES
      ? [...next].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, MAX_ENTRIES)
      : next;

  await writeData(DOC, trimmed);
  return NextResponse.json({ success: true, entry });
}
