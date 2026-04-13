"use client";

import { useState, useEffect, useCallback } from "react";
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

        // Today's non-Thunder games
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
        const todayStr = today;
        setCalendarEvents(
          events.filter((e: CalendarEvent) => e.start.startsWith(todayStr))
        );
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
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const now = new Date();
  const dateStr = format(now, "EEEE, MMMM d, yyyy");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4 no-print">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Cowboy Cold Daily Briefing
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-sm text-muted">{dateStr}</p>
              {weather && (
                <span className="text-xs bg-surface px-2 py-0.5 rounded text-amber">
                  {weather.temp}°F &middot; {weather.condition}
                </span>
              )}
            </div>
            {holidays.length > 0 && (
              <div className="flex gap-2 mt-1 flex-wrap">
                {holidays.map((h, i) => (
                  <span
                    key={i}
                    className="text-xs bg-copper/20 text-copper px-2 py-0.5 rounded-full font-medium"
                  >
                    {h.emoji} {h.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            <ThunderSection game={thunderGame} />
            <TVGamesSection games={tvGames} />
            <CalendarSection events={calendarEvents} />
            <MenuSection menuData={menuData} />
            <LocalEventsSection events={localEvents} />
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
