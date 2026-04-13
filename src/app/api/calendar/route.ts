import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getCached, setCache } from "@/lib/cache";
import type { CalendarEvent } from "@/lib/types";

const CACHE_KEY = "calendar-events";
const CACHE_TTL = 300; // 5 minutes

function getCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
  return google.calendar({ version: "v3", auth });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  const cached = getCached<CalendarEvent[]>(CACHE_KEY);
  if (cached) return NextResponse.json({ events: cached, cached: true });

  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendar || !calendarId) {
    return NextResponse.json({
      events: [],
      error: "Configure GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY",
    });
  }

  try {
    const now = new Date();
    const future = new Date(now);
    future.setDate(future.getDate() + days);

    const res = await calendar.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    const events: CalendarEvent[] = (res.data.items || []).map((item) => ({
      id: item.id || "",
      summary: item.summary || "Untitled Event",
      description: item.description || undefined,
      start: item.start?.dateTime || item.start?.date || "",
      end: item.end?.dateTime || item.end?.date || "",
      location: item.location || undefined,
    }));

    setCache(CACHE_KEY, events, CACHE_TTL);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("Calendar API error:", err);
    return NextResponse.json({ events: [], error: "Failed to fetch calendar events" }, { status: 500 });
  }
}
