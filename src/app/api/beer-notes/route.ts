import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/storage";
import { beerNoteKey, type BeerNote } from "@/lib/beer-notes";

const DOC = "beer-notes.json";

type NotesMap = Record<string, BeerNote>;

function isAdmin(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  return request.headers.get("x-admin-password") === password;
}

// Ask Claude for a 1–2 sentence tasting note. Returns null on any failure
// (missing key, network, malformed response) so the caller can degrade.
async function generateTastingNote(input: {
  name: string;
  style?: string;
  abv?: number;
  ibu?: number;
  brewery?: string;
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const facts = [
    `Beer: ${input.name}`,
    input.brewery ? `Brewery: ${input.brewery}` : "",
    input.style ? `Style: ${input.style}` : "",
    input.abv !== undefined ? `ABV: ${input.abv}%` : "",
    input.ibu !== undefined ? `IBU: ${input.ibu}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are helping a bartender describe a beer to a customer who asks what it tastes like. Write a natural, concise 1–2 sentence tasting note focusing on aroma and flavor. No filler, no "this beer is", no marketing speak. Do not repeat the style name.

${facts}

Tasting note:`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("Anthropic API error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (typeof text !== "string") return null;
    return text.trim().replace(/^"|"$/g, "");
  } catch (err) {
    console.error("Anthropic API call failed:", err);
    return null;
  }
}

// GET /api/beer-notes?name=...&brewery=...&style=...&abv=...&ibu=...
// Returns cached note if present; otherwise generates via AI, caches, returns.
// Never fails — returns { note: null } if there's no note and none can be made.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const brewery = searchParams.get("brewery")?.trim() || undefined;
  const style = searchParams.get("style")?.trim() || undefined;
  const abvRaw = searchParams.get("abv");
  const ibuRaw = searchParams.get("ibu");
  const abv = abvRaw ? Number(abvRaw) : undefined;
  const ibu = ibuRaw ? Number(ibuRaw) : undefined;

  const key = beerNoteKey(name, brewery);
  const notes = await readData<NotesMap>(DOC);
  const cached = notes[key];
  if (cached) return NextResponse.json({ note: cached });

  const generated = await generateTastingNote({ name, style, abv, ibu, brewery });
  if (!generated) return NextResponse.json({ note: null });

  const entry: BeerNote = {
    key,
    tastingNotes: generated,
    source: "ai",
    updatedAt: new Date().toISOString(),
  };
  notes[key] = entry;
  await writeData(DOC, notes);
  return NextResponse.json({ note: entry });
}

// POST /api/beer-notes  (admin) — write a manual note that wins over AI.
// Body: { name, brewery?, tastingNotes } — an empty tastingNotes deletes the entry.
export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const brewery = typeof body.brewery === "string" ? body.brewery.trim() : undefined;
  const text = typeof body.tastingNotes === "string" ? body.tastingNotes.trim() : "";

  const key = beerNoteKey(name, brewery);
  const notes = await readData<NotesMap>(DOC);

  if (!text) {
    delete notes[key];
    await writeData(DOC, notes);
    return NextResponse.json({ success: true, note: null });
  }

  const entry: BeerNote = {
    key,
    tastingNotes: text,
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
  notes[key] = entry;
  await writeData(DOC, notes);
  return NextResponse.json({ success: true, note: entry });
}

// LIST for the admin editor. Returns the whole map.
export async function PUT() {
  const notes = await readData<NotesMap>(DOC);
  return NextResponse.json({ notes });
}
