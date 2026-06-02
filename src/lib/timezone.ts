// Timezone helpers for the briefing pipeline.
//
// The dashboard is a single-location, OKC-based tool, so "today" and all
// displayed times mean Central Time — regardless of where the server runs
// (Vercel runs in UTC). On-site staff viewing the dashboard in a browser get
// Central automatically; these helpers make the server side (the email
// briefing and manually-entered event times) agree.
//
// Override the zone with APP_TIMEZONE if the venue ever moves.
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Chicago";

// The calendar date (YYYY-MM-DD) for an instant, in the app timezone.
// en-CA formats as YYYY-MM-DD.
export function dateKeyInZone(date: Date, timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Offset in ms (zoned wall clock minus UTC) for the given instant. Central is
// -5h in summer (CDT) and -6h in winter (CST); this resolves DST correctly for
// the instant supplied.
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const utc = new Date(instant.toLocaleString("en-US", { timeZone: "UTC" }));
  const zoned = new Date(instant.toLocaleString("en-US", { timeZone }));
  return zoned.getTime() - utc.getTime();
}

// Convert a wall-clock date/time in the app timezone to the matching UTC
// instant. `dateStr` is YYYY-MM-DD, `timeStr` is HH:MM (24-hour).
// e.g. ("2026-06-01", "19:00") in Central -> 2026-06-02T00:00:00Z.
export function zonedWallTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string = APP_TIMEZONE
): Date {
  // Treat the wall time as if it were UTC, then back out the zone's offset.
  const asUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  if (isNaN(asUtc.getTime())) return asUtc;
  const offset = zoneOffsetMs(asUtc, timeZone);
  return new Date(asUtc.getTime() - offset);
}

// Start of the given day (00:00 in the app timezone) as a UTC instant.
export function startOfDayInZone(date: Date, timeZone: string = APP_TIMEZONE): Date {
  return zonedWallTimeToUtc(dateKeyInZone(date, timeZone), "00:00", timeZone);
}

// Two instants fall on the same calendar day in the app timezone.
export function isSameDayInZone(
  a: Date,
  b: Date,
  timeZone: string = APP_TIMEZONE
): boolean {
  return dateKeyInZone(a, timeZone) === dateKeyInZone(b, timeZone);
}

// Format an instant's time-of-day in the app timezone, e.g. "7:05 PM".
export function formatTimeInZone(date: Date, timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

// Format a YYYY-MM-DD calendar date as a human label. The key already names a
// specific calendar day, so it is rendered in UTC at midday to avoid any
// boundary ambiguity. `style` controls month width.
export function formatDateLabel(
  dateKey: string,
  style: "long" | "short" = "long"
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: style,
    day: "numeric",
    ...(style === "long" ? { year: "numeric" } : {}),
  }).format(new Date(`${dateKey}T12:00:00Z`));
}
