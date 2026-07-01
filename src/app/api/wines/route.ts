import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/storage";
import type { Wine, WineCategory } from "@/lib/wine";

const WINES_DOC = "wines.json";

const VALID_CATEGORIES: WineCategory[] = [
  "red",
  "white",
  "rose",
  "sparkling",
  "orange",
  "dessert",
];

function isAdmin(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  return request.headers.get("x-admin-password") === password;
}

function optString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed ? trimmed : undefined;
}

function optNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

// Public read for the /wines page.
export async function GET() {
  const wines = await readData<Wine[]>(WINES_DOC);
  return NextResponse.json({ wines });
}

// Admin-only bulk replace, same pattern as the inventory catalog.
export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.wines)) {
    return NextResponse.json({ error: "wines array is required" }, { status: 400 });
  }

  const cleaned: Wine[] = [];
  for (const raw of body.wines) {
    if (!raw || typeof raw !== "object") continue;
    const name = optString(raw.name);
    if (!name) continue;
    const category: WineCategory = VALID_CATEGORIES.includes(raw.category)
      ? raw.category
      : "red";

    cleaned.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : `wine-${Date.now()}-${cleaned.length}`,
      name,
      category,
      producer: optString(raw.producer),
      varietal: optString(raw.varietal),
      region: optString(raw.region),
      vintage: optString(raw.vintage),
      abv: optNumber(raw.abv),
      glassPrice: optNumber(raw.glassPrice),
      bottlePrice: optNumber(raw.bottlePrice),
      notes: optString(raw.notes),
    });
  }

  await writeData(WINES_DOC, cleaned);
  return NextResponse.json({ success: true, wines: cleaned });
}
