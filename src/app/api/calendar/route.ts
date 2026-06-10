import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import { readData } from "@/lib/storage";
import { startOfDayInZone, zonedWallTimeToUtc } from "@/lib/timezone";
import type { CalendarEvent } from "@/lib/types";
import ICAL from "ical.js";

const CACHE_KEY = "calendar-events";
const CACHE_TTL = 300; // 5 minutes

const CONFIG_DOC = "admin-config.json";

interface ManualEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  endTime?: string;
  venue?: string;
  url?: string;
  description?: string;
}

// Manually-added events live in admin-config.json and are surfaced here as
// "Our Events" alongside the iCal feeds. They are read fresh on every request
// (not cached) so newly added events show up immediately, and they appear even
// when no iCal feeds are configured.
async function fetchManualEvents(days: number): Promise<CalendarEvent[]> {
  try {
    const config = await readData<{ manualEvents?: ManualEvent[] }>(CONFIG_DOC);
    const manual: ManualEvent[] = config.manualEvents || [];

    const now = new Date();
    // Day boundaries and event times are interpreted in the app timezone
    // (Central), since staff enter wall-clock times for the OKC venue.
    const todayStart = startOfDayInZone(now);
    const future = new Date(now);
    future.setDate(future.getDate() + days);

    const events: CalendarEvent[] = [];
    for (const e of manual) {
      if (!e.date) continue;
      const time = /^\d{2}:\d{2}$/.test(e.time) ? e.time : "00:00";
      const start = zonedWallTimeToUtc(e.date, time);
      if (isNaN(start.getTime())) continue;
      // Keep events from the start of today through the requested window so
      // today's events stay visible even after their start time has passed.
      if (start < todayStart || start > future) continue;

      const end =
        e.endTime && /^\d{2}:\d{2}$/.test(e.endTime)
          ? zonedWallTimeToUtc(e.date, e.endTime)
          : start;

      events.push({
        id: e.id,
        summary: e.name,
        description: e.description || undefined,
        start: start.toISOString(),
        end: end.toISOString(),
        location: e.venue || undefined,
        url: e.url || undefined,
      });
    }
    return events;
  } catch (err) {
    console.error("Manual events read error:", err);
    return [];
  }
}

function sortByStart(events: CalendarEvent[]): CalendarEvent[] {
  return events.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

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

  // Manual events are always read fresh and merged into every response path.
  const manualEvents = await fetchManualEvents(days);

  const cached = getCached<CalendarEvent[]>(CACHE_KEY);
  if (cached) {
    return NextResponse.json({
      events: sortByStart([...cached, ...manualEvents]),
      cached: true,
    });
  }

  const icalUrls = getIcalUrls();

  if (icalUrls.length === 0) {
    return NextResponse.json({
      events: sortByStart([...manualEvents]),
      ...(manualEvents.length === 0 && {
        error: "Configure GOOGLE_ICAL_URLS with your calendar iCal feed URLs",
      }),
    });
  }

  try {
    // Fetch all calendars in parallel
    const results = await Promise.all(
      icalUrls.map((url) => fetchIcalEvents(url, days))
    );
    const icalEvents = results.flat();

    // Cache only the iCal events; manual events are merged in fresh each time.
    setCache(CACHE_KEY, icalEvents, CACHE_TTL);
    return NextResponse.json({
      events: sortByStart([...icalEvents, ...manualEvents]),
    });
  } catch (err) {
    console.error("Calendar fetch error:", err);
    return NextResponse.json(
      { events: sortByStart([...manualEvents]), error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}
