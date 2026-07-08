import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/storage";
import type { ManualLink } from "@/lib/manuals";

const DOC = "manuals.json";

function isAdmin(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  return request.headers.get("x-admin-password") === password;
}

// Public read for the /help page.
export async function GET() {
  const manuals = await readData<ManualLink[]>(DOC);
  return NextResponse.json({ manuals });
}

// Admin-only bulk replace, same pattern as wines/catalog.
export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.manuals)) {
    return NextResponse.json({ error: "manuals array is required" }, { status: 400 });
  }

  const cleaned: ManualLink[] = [];
  for (const raw of body.manuals) {
    if (!raw || typeof raw !== "object") continue;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const url = typeof raw.url === "string" ? raw.url.trim() : "";
    if (!title || !/^https?:\/\//i.test(url)) continue;
    cleaned.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : `manual-${Date.now()}-${cleaned.length}`,
      title,
      url,
      note: typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : undefined,
    });
  }

  await writeData(DOC, cleaned);
  return NextResponse.json({ success: true, manuals: cleaned });
}
