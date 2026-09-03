"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import Image from "next/image";
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
import { SuppliesSection } from "./SuppliesSection";
import { AnnouncementPopup } from "./AnnouncementPopup";

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
    <div className="min-h-screen bg-paper-2">
      {/* Holiday Banner — only shows on holidays, always at top. A flat
          yellow block with purple type: the brand's "look here" pairing. */}
      {hasHolidays && (
        <div className="bg-yellow text-purple">
          <div className="max-w-3xl mx-auto px-4 py-3 text-center">
            {holidays.map((h, i) => (
              <div key={i} className="text-lg font-bold">
                <span className="text-2xl mr-2">{h.emoji}</span>
                {h.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header: the green brand bar with the Lively lockup */}
      <header className="sticky top-0 z-50 bg-green text-paper px-4 py-4 no-print">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <Image
                src="/brand/lockup-horizontal-long-white.svg"
                alt="Lively Beerworks"
                width={123}
                height={40}
                priority
                unoptimized
                className="h-10 w-auto shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight leading-tight">Daily Briefing</h1>
                <p className="text-sm text-paper/80 mt-0.5">{dateStr}</p>
              </div>
              {weather && (
                <div className="bg-green-deep border-2 border-paper/20 rounded-md px-3 py-2 flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-2xl leading-none">{weather.icon}</div>
                    <div className="text-lg font-bold mt-0.5">{weather.temp}°F</div>
                    <div className="text-[10px] font-bold text-yellow leading-tight mt-0.5">
                      H:{weather.high}° L:{weather.low}°
                    </div>
                  </div>
                  <div className="hidden sm:block max-w-[200px]">
                    <p className="text-xs font-bold">{weather.condition}</p>
                    <p className="text-[10px] text-paper/70 leading-snug mt-0.5 line-clamp-3">
                      {weather.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="text-xs font-bold border-2 border-paper/60 text-paper hover:bg-paper hover:text-green hover:border-paper px-3 py-1.5 rounded-md transition-colors duration-150 disabled:opacity-50 shrink-0"
            >
              {loading ? "..." : "Refresh"}
            </button>
          </div>

          {/* Nav: labeled links, left-aligned, tablet-friendly tap targets */}
          <nav className="mt-3 flex flex-wrap gap-2">
            {[
              { href: "/inventory", label: "Inventory" },
              { href: "/notes", label: "Notes" },
              { href: "/supplies", label: "Supplies" },
              { href: "/book", label: "The Book" },
              { href: "/schedule", label: "Schedule" },
              { href: "/production", label: "Production" },
              { href: "/beers", label: "Beer List" },
              { href: "/wines", label: "Wine List" },
              { href: "/help", label: "Help" },
              { href: "/print", label: "Print" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md border-2 border-paper/50 px-4 py-2 text-sm font-bold text-paper hover:bg-paper hover:text-green hover:border-paper transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>
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
            <AnnouncementPopup />
            <SuppliesSection />
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
