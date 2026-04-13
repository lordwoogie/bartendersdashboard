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
  const dateStr = now.toISOString().split("T")[0];
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

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

  // Filter today's games only (not thunder — that's separate)
  const todayStart = new Date(dateStr);
  const todayEnd = new Date(dateStr);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const tvGames = games.filter(
    (g) =>
      !g.isThunder &&
      new Date(g.time) >= todayStart &&
      new Date(g.time) < todayEnd
  );

  // Filter today's calendar events
  const todayCalendarEvents = calendarEvents.filter((e) => {
    const start = new Date(e.start);
    return start >= todayStart && start < todayEnd;
  });

  // Filter today's local events
  const todayLocalEvents = localEvents.filter((e) => {
    const start = new Date(e.start);
    return start >= todayStart && start < todayEnd;
  });

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
