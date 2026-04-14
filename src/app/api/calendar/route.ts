import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import type { CalendarEvent } from "@/lib/types";
import ICAL from "ical.js";

const CACHE_KEY = "calendar-events";
const CACHE_TTL = 300; // 5 minutes

// iCal feed URLs (secret address in iCal format from Google Calendar settings)
// Set these as comma-separated URLs in the env var
// e.g., GOOGLE_ICAL_URLS=https://calendar.google.com/calendar/ical/xxx/private-yyy/basic.ics,https://calendar.google.com/calendar/ical/zzz/private-www/basic.ics
function getIcalUrls(): string[] {
  const urls = process.env.GOOGLE_ICAL_URLS;
  if (!urls) return [];
  return urls.split(",").map((u) => u.trim()).filter(Boolean);
}

async function fetchIcalEvents(url: string, days: number): Promise<CalendarEvent[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`iCal fetch failed for ${url}: ${res.status}`);
      return [];
    }
    const text = await res.text();
    const jcal = ICAL.parse(text);
    const comp = new ICAL.Component(jcal);
    const vevents = comp.getAllSubcomponents("vevent");

    const now = new Date();
    const future = new Date(now);
    future.setDate(future.getDate() + days);

    const events: CalendarEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      // Handle recurring events
      if (event.isRecurring()) {
        const iterator = event.iterator();
        let next = iterator.next();
        // Check up to 100 occurrences to find ones in our range
        let count = 0;
        while (next && count < 100) {
          const occurrenceStart = next.toJSDate();
          if (occurrenceStart > future) break;
          if (occurrenceStart >= now) {
            const duration = event.duration;
            const endDate = new Date(occurrenceStart.getTime() + (duration ? duration.toSeconds() * 1000 : 3600000));
            events.push({
              id: `${event.uid}-${occurrenceStart.toISOString()}`,
              summary: event.summary || "Untitled Event",
              description: event.description || undefined,
              start: occurrenceStart.toISOString(),
              end: endDate.toISOString(),
              location: event.location || undefined,
            });
          }
          next = iterator.next();
          count++;
        }
      } else {
        const startDate = event.startDate?.toJSDate();
        const endDate = event.endDate?.toJSDate();
        if (!startDate) continue;

        // Only include events within our range
        if (startDate >= now && startDate <= future) {
          events.push({
            id: event.uid || `ical-${events.length}`,
            summary: event.summary || "Untitled Event",
            description: event.description || undefined,
            start: startDate.toISOString(),
            end: endDate?.toISOString() || startDate.toISOString(),
            location: event.location || undefined,
          });
        }
      }
    }

    return events;
  } catch (err) {
    console.error("iCal parse error:", err);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  const cached = getCached<CalendarEvent[]>(CACHE_KEY);
  if (cached) return NextResponse.json({ events: cached, cached: true });

  const icalUrls = getIcalUrls();

  if (icalUrls.length === 0) {
    return NextResponse.json({
      events: [],
      error: "Configure GOOGLE_ICAL_URLS with your calendar iCal feed URLs",
    });
  }

  try {
    // Fetch all calendars in parallel
    const results = await Promise.all(
      icalUrls.map((url) => fetchIcalEvents(url, days))
    );
    const allEvents = results.flat();

    // Sort by start time
    allEvents.sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    setCache(CACHE_KEY, allEvents, CACHE_TTL);
    return NextResponse.json({ events: allEvents });
  } catch (err) {
    console.error("Calendar fetch error:", err);
    return NextResponse.json(
      { events: [], error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}
