import { APP_TIMEZONE, dateKeyInZone } from "./timezone";
import type {
  BriefingData,
  SportsGame,
  CalendarEvent,
  LocalEvent,
  Holiday,
  MenuData,
  WeatherData,
} from "./types";

export async function fetchBriefingData(baseUrl: string): Promise<BriefingData> {
  const now = new Date();
  // "Today" is the Central calendar day so an opener sees the whole day's
  // events, including the evening, regardless of the server's timezone.
  const dateStr = dateKeyInZone(now);
  const dayOfWeek = now.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: APP_TIMEZONE,
  });

  const [sportsRes, calendarRes, eventsRes, holidaysRes, menuRes, weatherRes] =
    await Promise.allSettled([
      fetch(`${baseUrl}/api/sports?date=${dateStr}`).then((r) => r.json()),
      fetch(`${baseUrl}/api/calendar`).then((r) => r.json()),
      fetch(`${baseUrl}/api/events`).then((r) => r.json()),
      fetch(`${baseUrl}/api/holidays?date=${dateStr}`).then((r) => r.json()),
      fetch(`${baseUrl}/api/menu`).then((r) => r.json()),
      fetch(`${baseUrl}/api/weather`).then((r) => r.json()),
    ]);

  const games: SportsGame[] =
    sportsRes.status === "fulfilled" ? sportsRes.value.games || [] : [];
  const calendarEvents: CalendarEvent[] =
    calendarRes.status === "fulfilled" ? calendarRes.value.events || [] : [];
  const localEvents: LocalEvent[] =
    eventsRes.status === "fulfilled" ? eventsRes.value.events || [] : [];
  const holidays: Holiday[] =
    holidaysRes.status === "fulfilled" ? holidaysRes.value.today || [] : [];
  const menuData: MenuData =
    menuRes.status === "fulfilled"
      ? menuRes.value.menu || { items: [], changes: [], lastUpdated: null }
      : { items: [], changes: [], lastUpdated: null };
  const weather: WeatherData | undefined =
    weatherRes.status === "fulfilled" ? weatherRes.value.weather || undefined : undefined;

  const thunderGame = games.find((g) => g.isThunder);

  // Everything below is "today" in Central terms: an event/game belongs to
  // today when its Central calendar date matches today's.
  const isToday = (instant: string) => dateKeyInZone(new Date(instant)) === dateStr;

  // Filter today's games only (not thunder — that's separate)
  const tvGames = games.filter((g) => !g.isThunder && isToday(g.time));

  // Filter today's calendar events
  const todayCalendarEvents = calendarEvents.filter((e) => isToday(e.start));

  // Filter today's local events
  const todayLocalEvents = localEvents.filter((e) => isToday(e.start));

  return {
    date: dateStr,
    dayOfWeek,
    weather,
    holidays,
    thunderGame,
    tvGames,
    calendarEvents: todayCalendarEvents,
    menuData,
    localEvents: todayLocalEvents,
  };
}
