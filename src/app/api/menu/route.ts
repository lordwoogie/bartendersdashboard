import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import type { MenuItem, MenuChange, MenuData } from "@/lib/types";
import fs from "fs/promises";
import path from "path";

const CACHE_KEY = "menu-data";
const CACHE_TTL = 600; // 10 minutes
const SNAPSHOT_PATH = path.join(process.cwd(), "src/data/menu-snapshot.json");

interface MenuSnapshot {
  lastFetched: string | null;
  items: MenuItem[];
}

async function readSnapshot(): Promise<MenuSnapshot> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { lastFetched: null, items: [] };
  }
}

async function writeSnapshot(snapshot: MenuSnapshot) {
  try {
    await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
  } catch (err) {
    console.error("Failed to write menu snapshot:", err);
  }
}

async function fetchUntappdMenu(): Promise<MenuItem[]> {
  const apiUrl = process.env.UNTAPPD_API_URL;
  const apiKey = process.env.UNTAPPD_API_KEY;
  if (!apiUrl || !apiKey) return [];

  try {
    // Untappd for Business API - fetch menu sections and items
    const res = await fetch(`${apiUrl}/sections`, {
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();

    const items: MenuItem[] = [];
    for (const section of data.sections || []) {
      for (const item of section.items || []) {
        items.push({
          id: String(item.id),
          name: item.name || "Unknown",
          style: item.style || undefined,
          abv: item.abv ? parseFloat(item.abv) : undefined,
          brewery: item.brewery || undefined,
          description: item.description || undefined,
          section: section.name || undefined,
        });
      }
    }
    return items;
  } catch (err) {
    console.error("Untappd API error:", err);
    return [];
  }
}

function detectChanges(
  previous: MenuItem[],
  current: MenuItem[],
  timestamp: string
): MenuChange[] {
  const changes: MenuChange[] = [];
  const prevMap = new Map(previous.map((i) => [i.id, i]));
  const currMap = new Map(current.map((i) => [i.id, i]));

  // New items
  for (const [id, item] of currMap) {
    if (!prevMap.has(id)) {
      changes.push({ type: "added", item, timestamp });
    }
  }

  // Removed items
  for (const [id, item] of prevMap) {
    if (!currMap.has(id)) {
      changes.push({ type: "removed", item, timestamp });
    }
  }

  // Changed items (name or section changed = tap swap)
  for (const [id, curr] of currMap) {
    const prev = prevMap.get(id);
    if (prev && (prev.name !== curr.name || prev.section !== curr.section)) {
      changes.push({
        type: "changed",
        item: curr,
        timestamp,
        detail: `Was: ${prev.name} (${prev.section})`,
      });
    }
  }

  return changes;
}

export async function GET() {
  const cached = getCached<MenuData>(CACHE_KEY);
  if (cached) return NextResponse.json({ menu: cached, cached: true });

  if (!process.env.UNTAPPD_API_URL || !process.env.UNTAPPD_API_KEY) {
    return NextResponse.json({
      menu: { items: [], changes: [], lastUpdated: null },
      error: "Configure UNTAPPD_API_URL and UNTAPPD_API_KEY",
    });
  }

  const currentItems = await fetchUntappdMenu();
  const snapshot = await readSnapshot();
  const now = new Date().toISOString();

  const changes = snapshot.lastFetched
    ? detectChanges(snapshot.items, currentItems, now)
    : [];

  // Update snapshot
  await writeSnapshot({ lastFetched: now, items: currentItems });

  const menuData: MenuData = {
    items: currentItems,
    changes,
    lastUpdated: now,
  };

  setCache(CACHE_KEY, menuData, CACHE_TTL);
  return NextResponse.json({ menu: menuData });
}
