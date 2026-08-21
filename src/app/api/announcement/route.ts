import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/storage";
import { isValidDay, type Announcement } from "@/lib/announcements";

const DOC = "announcement.json";

// The pop-up polls this while the tablet sits open, so it must never be
// served from a cache — a new announcement should appear within a minute.
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

function isAdmin(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  return request.headers.get("x-admin-password") === password;
}

// GET /api/announcement — public; the dashboard pop-up reads this.
export async function GET() {
  const announcement = await readData<Announcement>(DOC);
  return NextResponse.json({ announcement }, { headers: NO_STORE });
}

// POST /api/announcement { message, lastDay, enabled } — admin-only replace.
export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > 300) {
    return NextResponse.json({ error: "message is too long" }, { status: 400 });
  }
  if (!isValidDay(body.lastDay)) {
    return NextResponse.json(
      { error: "lastDay must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const current = await readData<Announcement>(DOC);
  const announcement: Announcement = {
    // Device snoozes key on the id, so a changed message gets a fresh id —
    // everyone sees the new text even if they dismissed the old one. Toggling
    // enabled or extending the date keeps the id (and existing snoozes).
    id:
      current.message === message
        ? current.id
        : `ann-${Date.now().toString(36)}`,
    message,
    lastDay: body.lastDay,
    enabled: body.enabled === true,
    updatedAt: new Date().toISOString(),
  };

  await writeData(DOC, announcement);
  return NextResponse.json({ success: true, announcement });
}
