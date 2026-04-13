import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import type { LocalEvent } from "@/lib/types";

const CACHE_KEY = "local-events";
const CACHE_TTL = 3600; // 1 hour

const OKC_LAT = 35.4634;
const OKC_LNG = -97.5151;
const RADIUS_MILES = 10;

async function fetchEventbrite(): Promise<LocalEvent[]> {
  const key = process.env.EVENTBRITE_API_KEY;
  if (!key) return [];

  try {
    const now = new Date().toISOString();
    const weekOut = new Date();
    weekOut.setDate(weekOut.getDate() + 7);

    const url = new URL("https://www.eventbriteapi.com/v3/events/search/");
    url.searchParams.set("location.latitude", String(OKC_LAT));
    url.searchParams.set("location.longitude", String(OKC_LNG));
    url.searchParams.set("location.within", `${RADIUS_MILES}mi`);
    url.searchParams.set("start_date.range_start", now);
    url.searchParams.set("start_date.range_end", weekOut.toISOString());
    url.searchParams.set("sort_by", "date");
    url.searchParams.set("expand", "venue");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.events || []).map((e: Record<string, unknown>) => {
      const venue = e.venue as Record<string, unknown> | undefined;
      const start = e.start as Record<string, string>;
      const end = e.end as Record<string, string>;
      const name = e.name as Record<string, string>;

      return {
        id: `eb-${e.id}`,
        name: name?.text || "Unnamed Event",
        venue: (venue?.name as string) || undefined,
        category: "community",
        start: start?.utc || "",
        end: end?.utc || undefined,
        source: "eventbrite" as const,
        url: e.url as string | undefined,
      };
    });
  } catch (err) {
    console.error("Eventbrite API error:", err);
    return [];
  }
}

async function fetchPredictHQ(): Promise<LocalEvent[]> {
  const key = process.env.PREDICTHQ_API_KEY;
  if (!key) return [];

  try {
    const now = new Date().toISOString().split("T")[0];
    const weekOut = new Date();
    weekOut.setDate(weekOut.getDate() + 7);
    const endDate = weekOut.toISOString().split("T")[0];

    const url = new URL("https://api.predicthq.com/v1/events/");
    url.searchParams.set("within", `${RADIUS_MILES}mi@${OKC_LAT},${OKC_LNG}`);
    url.searchParams.set("active.gte", now);
    url.searchParams.set("active.lte", endDate);
    url.searchParams.set(
      "category",
      "concerts,festivals,community,severe-weather,public-holidays,performing-arts,sports"
    );
    url.searchParams.set("sort", "start");
    url.searchParams.set("limit", "50");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.results || []).map((e: Record<string, unknown>) => ({
      id: `phq-${e.id}`,
      name: (e.title as string) || "Unnamed Event",
      venue: (e.entities as Record<string, unknown>[])
        ?.find((ent) => (ent.type as string) === "venue")
        ?.name as string | undefined,
      category: (e.category as string) || "community",
      start: (e.start as string) || "",
      end: (e.end as string) || undefined,
      source: "predicthq" as const,
    }));
  } catch (err) {
    console.error("PredictHQ API error:", err);
    return [];
  }
}

function deduplicateEvents(events: LocalEvent[]): LocalEvent[] {
  const seen = new Map<string, LocalEvent>();
  for (const event of events) {
    const key = `${event.name.toLowerCase().trim()}-${event.start.split("T")[0]}`;
    if (!seen.has(key)) {
      seen.set(key, event);
    }
  }
  return Array.from(seen.values());
}

export async function GET() {
  const cached = getCached<LocalEvent[]>(CACHE_KEY);
  if (cached) return NextResponse.json({ events: cached, cached: true });

  const [eventbriteEvents, predictHQEvents] = await Promise.all([
    fetchEventbrite(),
    fetchPredictHQ(),
  ]);

  const combined = deduplicateEvents([...eventbriteEvents, ...predictHQEvents]);
  combined.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  setCache(CACHE_KEY, combined, CACHE_TTL);

  const errors: string[] = [];
  if (!process.env.EVENTBRITE_API_KEY) errors.push("Configure EVENTBRITE_API_KEY");
  if (!process.env.PREDICTHQ_API_KEY) errors.push("Configure PREDICTHQ_API_KEY");

  return NextResponse.json({
    events: combined,
    ...(errors.length > 0 && { errors }),
  });
}
