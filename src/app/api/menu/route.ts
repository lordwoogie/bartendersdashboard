import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import type { MenuItem, MenuChange, MenuData } from "@/lib/types";
import fs from "fs/promises";
import path from "path";

const CACHE_KEY = "menu-data";
const CACHE_TTL = 600; // 10 minutes
const SNAPSHOT_PATH = path.join(process.cwd(), "src/data/menu-snapshot.json");
const VENUE_URL =
  process.env.UNTAPPD_VENUE_URL ||
  "https://untappd.com/v/lively-beerworks/9555097";

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

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function fetchUntappdMenu(): Promise<MenuItem[]> {
  try {
    const res = await fetch(VENUE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) {
      console.error("Untappd fetch failed:", res.status);
      return [];
    }
    const html = await res.text();
    const items: MenuItem[] = [];

    // Split by menu-section divs
    const sectionSplits = html.split(/<div class="menu-section" id="section_/);

    for (let i = 1; i < sectionSplits.length; i++) {
      const sectionBlock = sectionSplits[i];

      // Get section name from <h4> tag
      const sectionNameMatch = sectionBlock.match(
        /<h4>\s*([\s\S]*?)\s*<span/
      );
      const sectionName = sectionNameMatch
        ? stripHtml(sectionNameMatch[1])
        : "On Tap";

      // Split by menu-item entries
      const itemBlocks = sectionBlock.split(/<li class="menu-item"/);

      for (let j = 1; j < itemBlocks.length; j++) {
        const block = itemBlocks[j];

        // Beer name: inside <h5><a ...>NAME</a>
        const nameMatch = block.match(
          /<h5>\s*<a[^>]*>([\s\S]*?)<\/a>/
        );
        if (!nameMatch) continue;
        let name = stripHtml(nameMatch[1]);
        // Remove leading number prefix like "20."
        name = name.replace(/^\d+\.\s*/, "");

        // Style: inside <em>STYLE</em> after the name link
        const styleMatch = block.match(/<em>(.*?)<\/em>/);
        const style = styleMatch ? stripHtml(styleMatch[1]) : undefined;

        // ABV: "X.X% ABV"
        const abvMatch = block.match(/([\d.]+)%\s*ABV/);
        const abv = abvMatch ? parseFloat(abvMatch[1]) : undefined;

        // Brewery: inside the brewery link
        const breweryMatch = block.match(
          /data-href=":brewery"[^>]*>([\s\S]*?)<\/a>/
        );
        const brewery = breweryMatch
          ? stripHtml(breweryMatch[1])
          : undefined;

        // Beer ID from the URL
        const bidMatch = block.match(/href="\/b\/[^"]*\/(\d+)"/);
        const bid = bidMatch ? bidMatch[1] : `${i}-${j}`;

        items.push({
          id: bid,
          name,
          style,
          abv,
          brewery,
          description: undefined,
          section: sectionName,
        });
      }
    }

    return items;
  } catch (err) {
    console.error("Untappd scrape error:", err);
    return [];
  }
}

function detectChanges(
  previous: MenuItem[],
  current: MenuItem[],
  timestamp: string
): MenuChange[] {
  const changes: MenuChange[] = [];
  const prevMap = new Map(previous.map((i) => [i.name.toLowerCase(), i]));
  const currMap = new Map(current.map((i) => [i.name.toLowerCase(), i]));

  for (const [name, item] of currMap) {
    if (!prevMap.has(name)) {
      changes.push({ type: "added", item, timestamp });
    }
  }

  for (const [name, item] of prevMap) {
    if (!currMap.has(name)) {
      changes.push({ type: "removed", item, timestamp });
    }
  }

  return changes;
}

export async function GET() {
  const cached = getCached<MenuData>(CACHE_KEY);
  if (cached) return NextResponse.json({ menu: cached, cached: true });

  const currentItems = await fetchUntappdMenu();
  const snapshot = await readSnapshot();
  const now = new Date().toISOString();

  const changes = snapshot.lastFetched
    ? detectChanges(snapshot.items, currentItems, now)
    : [];

  await writeSnapshot({ lastFetched: now, items: currentItems });

  const menuData: MenuData = {
    items: currentItems,
    changes,
    lastUpdated: now,
  };

  setCache(CACHE_KEY, menuData, CACHE_TTL);
  return NextResponse.json({ menu: menuData });
}
