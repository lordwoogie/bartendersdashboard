import { NextResponse } from "next/server";
import { readData, mutateData } from "@/lib/storage";
import type { SupplyItem } from "@/lib/supplies";

const DOC = "supplies.json";
const MAX_ITEMS = 500;

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

// Newest first, but to-buy items always float above notes so the list stays
// actionable when you glance at it.
function sort(items: SupplyItem[]): SupplyItem[] {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === "to-buy" ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// GET /api/supplies — everything, sorted for display.
export async function GET() {
  const items = await readData<SupplyItem[]>(DOC);
  return NextResponse.json({ items: sort(items) });
}

// POST /api/supplies — add a to-buy item or a note.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid body");

  const { type, text } = body as Record<string, unknown>;
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return badRequest("text is required");
  if (trimmed.length > 500) return badRequest("text is too long");
  if (type !== "to-buy" && type !== "note") {
    return badRequest("type must be 'to-buy' or 'note'");
  }

  const item: SupplyItem = {
    id: `sup-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36).padStart(4, "0")}`,
    type,
    text: trimmed,
    createdAt: new Date().toISOString(),
  };

  await mutateData<SupplyItem[]>(DOC, (items) => {
    const next = [...items, item];
    return next.length > MAX_ITEMS ? sort(next).slice(0, MAX_ITEMS) : next;
  });
  return NextResponse.json({ success: true, item });
}

// PATCH /api/supplies?id=... — toggle a to-buy item done/undone.
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("id is required");

  // Captured from inside the mutation; reset on each attempt because
  // mutateData may retry under contention.
  let outcome: "ok" | "missing" | "wrong-type" = "missing";
  let updated: SupplyItem | null = null;

  await mutateData<SupplyItem[]>(DOC, (items) => {
    outcome = "missing";
    updated = null;
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return items;
    const current = items[idx];
    if (current.type !== "to-buy") {
      outcome = "wrong-type";
      return items;
    }
    const next = [...items];
    next[idx] = {
      ...current,
      doneAt: current.doneAt ? undefined : new Date().toISOString(),
    };
    outcome = "ok";
    updated = next[idx];
    return next;
  });

  if (outcome === "missing") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (outcome === "wrong-type") {
    return badRequest("Only to-buy items have a done state");
  }
  return NextResponse.json({ success: true, item: updated });
}

// DELETE /api/supplies?id=... — remove any item (undo).
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("id is required");

  let found = false;
  await mutateData<SupplyItem[]>(DOC, (items) => {
    const next = items.filter((i) => i.id !== id);
    found = next.length !== items.length;
    return next;
  });

  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
