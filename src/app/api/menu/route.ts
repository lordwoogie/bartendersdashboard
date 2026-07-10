import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import { readData, writeData } from "@/lib/storage";
import type { MenuItem, MenuChange, MenuData } from "@/lib/types";

const CACHE_KEY = "menu-data";
const CACHE_TTL = 600; // 10 minutes
const SNAPSHOT_DOC = "menu-snapshot.json";
// How long a beer keeps its "new on tap" badge after first appearing.
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const VENUE_URL =
  process.env.UNTAPPD_VENUE_URL ||
  "https://untappd.com/v/lively-beerworks/9555097";

interface MenuSnapshot {
  lastFetched: string | null;
  items: MenuItem[];
  // beer name (lowercased) -> ISO instant it first appeared on the menu.
  // Drives the 7-day "new" badge; entries for departed beers get pruned.
  firstSeen?: Record<string, string>;
}

// Snapshot goes through the storage helper (Blob in production): the old
// direct-fs write failed on Vercel's read-only filesystem (EROFS), which is
// why new beers never got flagged as new.
async function readSnapshot(): Promise<MenuSnapshot> {
  try {
    return await readData<MenuSnapshot>(SNAPSHOT_DOC);
  } catch {
    return { lastFetched: null, items: [] };
  }
}

async function writeSnapshot(snapshot: MenuSnapshot) {
  try {
    await writeData(SNAPSHOT_DOC, snapshot);
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

        // IBU: "N IBU" (Untappd usually shows this next to ABV)
        const ibuMatch = block.match(/([\d.]+)\s*IBU/i);
        const ibu = ibuMatch ? parseFloat(ibuMatch[1]) : undefined;

        // Brewery: inside the brewery link
        const breweryMatch = block.match(
          /data-href=":brewery"[^>]*>([\s\S]*?)<\/a>/
        );
        const brewery = breweryMatch
          ? stripHtml(breweryMatch[1])
          : undefined;

        // Venue-added menu note or beer description block, if any.
        // Untappd shows these under various class names depending on template.
        const descMatch =
          block.match(/<p[^>]*class="[^"]*beer-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
          block.match(/<p[^>]*class="[^"]*menu-note[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        const description = descMatch
          ? stripHtml(descMatch[1]) || undefined
          : undefined;

        // Beer ID from the URL
        const bidMatch = block.match(/href="\/b\/[^"]*\/(\d+)"/);
        const bid = bidMatch ? bidMatch[1] : `${i}-${j}`;

        items.push({
          id: bid,
          name,
          style,
          abv,
          ibu,
          brewery,
          description,
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

// Sentinel for "was on the menu before we started tracking" — never counts
// as new.
const EPOCH = "1970-01-01T00:00:00.000Z";

export async function GET() {
  const cached = getCached<MenuData>(CACHE_KEY);
  if (cached) return NextResponse.json({ menu: cached, cached: true });

  const snapshot = await readSnapshot();
  let currentItems = await fetchUntappdMenu();
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  // Untappd hiccup (blocked/timeout): keep serving the last good menu
  // instead of wiping it — and don't touch the snapshot, or every beer
  // would flag as "new" when the scrape recovers.
  const scrapeFailed = currentItems.length === 0 && snapshot.items.length > 0;
  if (scrapeFailed) currentItems = snapshot.items;

  // First-seen bookkeeping, keyed by lowercased beer name. A beer is "new"
  // for NEW_WINDOW_MS after it first appears. Departed beers are pruned so
  // a returning seasonal counts as new again.
  const firstSeen: Record<string, string> = { ...(snapshot.firstSeen || {}) };
  const migrating = !snapshot.firstSeen; // snapshot from before this field
  const currentNames = new Set(currentItems.map((i) => i.name.toLowerCase()));
  for (const item of currentItems) {
    const key = item.name.toLowerCase();
    if (!firstSeen[key]) firstSeen[key] = migrating ? EPOCH : nowIso;
  }
  if (!scrapeFailed) {
    for (const key of Object.keys(firstSeen)) {
      if (!currentNames.has(key)) delete firstSeen[key];
    }
  }

  const changes: MenuChange[] = [];
  for (const item of currentItems) {
    const seen = firstSeen[item.name.toLowerCase()];
    if (seen && nowMs - new Date(seen).getTime() < NEW_WINDOW_MS) {
      changes.push({ type: "added", item, timestamp: seen });
    }
  }
  if (snapshot.lastFetched && !scrapeFailed) {
    for (const item of snapshot.items) {
      if (!currentNames.has(item.name.toLowerCase())) {
        changes.push({ type: "removed", item, timestamp: nowIso });
      }
    }
  }

  if (!scrapeFailed) {
    await writeSnapshot({ lastFetched: nowIso, items: currentItems, firstSeen });
  }

  const menuData: MenuData = {
    items: currentItems,
    changes,
    lastUpdated: nowIso,
  };

  setCache(CACHE_KEY, menuData, CACHE_TTL);
  return NextResponse.json({ menu: menuData });
}
