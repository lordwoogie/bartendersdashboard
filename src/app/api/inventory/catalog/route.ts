import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/storage";
import type { CatalogBeer } from "@/lib/inventory";

const CATALOG_DOC = "inventory-catalog.json";

const VALID_FORMATS: CatalogBeer["format"][] = ["keg", "can", "bottle"];

function isAdmin(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  return request.headers.get("x-admin-password") === password;
}

// GET is public so the tablet picker can populate without login.
export async function GET() {
  const catalog = await readData<CatalogBeer[]>(CATALOG_DOC);
  const sorted = [...catalog].sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ catalog: sorted });
}

// POST replaces the catalog. Admin-only.
export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.catalog)) {
    return NextResponse.json({ error: "catalog array is required" }, { status: 400 });
  }

  const cleaned: CatalogBeer[] = [];
  for (const raw of body.catalog) {
    if (!raw || typeof raw !== "object") continue;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) continue;
    const format = VALID_FORMATS.includes(raw.format) ? raw.format : "keg";
    cleaned.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : `beer-${Date.now()}-${cleaned.length}`,
      name,
      brewery: typeof raw.brewery === "string" && raw.brewery.trim() ? raw.brewery.trim() : undefined,
      format,
    });
  }

  await writeData(CATALOG_DOC, cleaned);
  return NextResponse.json({ success: true, catalog: cleaned });
}
