"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import type {
  SportsGame,
  CalendarEvent,
  LocalEvent,
  Holiday,
  MenuData,
  WeatherData,
} from "@/lib/types";
import { ThunderSection } from "./ThunderSection";
import { TVGamesSection } from "./TVGamesSection";
import { CalendarSection } from "./CalendarSection";
import { MenuSection } from "./MenuSection";
import { LocalEventsSection } from "./LocalEventsSection";
import { WeekAhead } from "./WeekAhead";

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [weather, setWeather] = useState<WeatherData | undefined>();
  const [thunderGame, setThunderGame] = useState<SportsGame | undefined>();
  const [tvGames, setTvGames] = useState<SportsGame[]>([]);
  const [allGames, setAllGames] = useState<SportsGame[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [allCalendarEvents, setAllCalendarEvents] = useState<CalendarEvent[]>([]);
  const [menuData, setMenuData] = useState<MenuData>({
    items: [],
    changes: [],
    lastUpdated: null,
  });
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);
  const [allLocalEvents, setAllLocalEvents] = useState<LocalEvent[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    try {
      const [sportsRes, calendarRes, eventsRes, holidaysRes, menuRes, weatherRes] =
        await Promise.allSettled([
          fetch(`/api/sports?date=${today}`).then((r) => r.json()),
          fetch("/api/calendar").then((r) => r.json()),
          fetch("/api/events").then((r) => r.json()),
          fetch(`/api/holidays?date=${today}`).then((r) => r.json()),
          fetch("/api/menu").then((r) => r.json()),
          fetch("/api/weather").then((r) => r.json()),
        ]);

      if (sportsRes.status === "fulfilled") {
        const games: SportsGame[] = sportsRes.value.games || [];
        setAllGames(games);
        setThunderGame(games.find((g: SportsGame) => g.isThunder));

        const todayStart = new Date(today);
        const todayEnd = new Date(today);
        todayEnd.setDate(todayEnd.getDate() + 1);
        setTvGames(
          games.filter(
            (g: SportsGame) =>
              !g.isThunder &&
              new Date(g.time) >= todayStart &&
              new Date(g.time) < todayEnd
          )
        );
      }

      if (calendarRes.status === "fulfilled") {
        const events: CalendarEvent[] = calendarRes.value.events || [];
        setAllCalendarEvents(events);
        // Keep all upcoming events (not just today) so we can pick nearest 2
        setCalendarEvents(events);
      }

      if (eventsRes.status === "fulfilled") {
        const events: LocalEvent[] = eventsRes.value.events || [];
        setAllLocalEvents(events);
        const todayStart = new Date(today);
        const todayEnd = new Date(today);
        todayEnd.setDate(todayEnd.getDate() + 1);
        setLocalEvents(
          events.filter((e: LocalEvent) => {
            const start = new Date(e.start);
            return start >= todayStart && start < todayEnd;
          })
        );
      }

      if (holidaysRes.status === "fulfilled") {
        setHolidays(holidaysRes.value.today || []);
      }

      if (menuRes.status === "fulfilled") {
        setMenuData(
          menuRes.value.menu || { items: [], changes: [], lastUpdated: null }
        );
      }

      if (weatherRes.status === "fulfilled") {
        setWeather(weatherRes.value.weather || undefined);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch briefing data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Get the 2 nearest upcoming events
  const nearestEvents = useMemo(() => {
    const now = new Date();
    return calendarEvents
      .filter((e) => new Date(e.start) >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 2);
  }, [calendarEvents]);

  const hasHolidays = holidays.length > 0;
  const now = new Date();
  const dateStr = format(now, "EEEE, MMMM d, yyyy");

  return (
    <div className="min-h-screen bg-background">
      {/* Holiday Banner — only shows on holidays, always at top */}
      {hasHolidays && (
        <div className="bg-gradient-to-r from-copper/30 via-amber/20 to-copper/30 border-b border-amber/30">
          <div className="max-w-3xl mx-auto px-4 py-3 text-center">
            {holidays.map((h, i) => (
              <div key={i} className="text-lg font-bold text-amber">
                <span className="text-2xl mr-2">{h.emoji}</span>
                {h.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4 no-print">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                Cowboy Cold Daily Briefing
              </h1>
              <p className="text-sm text-muted mt-0.5">{dateStr}</p>
            </div>
            {weather && (
              <div className="bg-surface border border-card-border rounded-lg px-3 py-2 flex items-center gap-3">
                <div className="text-center">
                  <div className="text-2xl leading-none">{weather.icon}</div>
                  <div className="text-lg font-bold text-foreground mt-0.5">{weather.temp}°F</div>
                  <div className="text-[10px] text-amber leading-tight mt-0.5">
                    H:{weather.high}° L:{weather.low}°
                  </div>
                </div>
                <div className="hidden sm:block max-w-[200px]">
                  <p className="text-xs text-foreground font-medium">{weather.condition}</p>
                  <p className="text-[10px] text-muted leading-snug mt-0.5 line-clamp-3">
                    {weather.description}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/schedule"
              className="text-xs text-muted hover:text-amber transition-colors no-print"
              title="Staff schedule"
            >
              📋
            </a>
            <a
              href="/beers"
              className="text-xs text-muted hover:text-amber transition-colors no-print"
              title="Full beer list"
            >
              🍺
            </a>
            <a
              href="/print"
              className="text-xs text-muted hover:text-amber transition-colors no-print"
              title="Print today's sheet"
            >
              🖨️
            </a>
            <button
              onClick={fetchData}
              disabled={loading}
              className="text-xs bg-surface hover:bg-card-border text-foreground px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading && !lastUpdated ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">🤠</div>
              <p className="text-muted">Loading today&apos;s briefing...</p>
            </div>
          </div>
        ) : (
          <>
            <CalendarSection events={nearestEvents} />
            <MenuSection menuData={menuData} />
            <LocalEventsSection events={localEvents} />
            <ThunderSection game={thunderGame} />
            <TVGamesSection games={tvGames} />
            <WeekAhead
              games={allGames}
              calendarEvents={allCalendarEvents}
              localEvents={allLocalEvents}
            />
          </>
        )}
      </main>

      {/* Floating last updated */}
      {lastUpdated && (
        <div className="fixed bottom-4 right-4 text-[10px] text-muted bg-card-bg/90 backdrop-blur border border-card-border px-2 py-1 rounded-lg no-print">
          Updated {format(lastUpdated, "h:mm a")}
        </div>
      )}
    </div>
  );
}
