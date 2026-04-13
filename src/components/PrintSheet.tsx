"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import type {
  SportsGame,
  CalendarEvent,
  LocalEvent,
  Holiday,
  MenuData,
} from "@/lib/types";

export function PrintSheet() {
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [thunderGame, setThunderGame] = useState<SportsGame | undefined>();
  const [tvGames, setTvGames] = useState<SportsGame[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [menuData, setMenuData] = useState<MenuData>({
    items: [],
    changes: [],
    lastUpdated: null,
  });
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);

  const fetchData = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    try {
      const [sportsRes, calendarRes, eventsRes, holidaysRes, menuRes] =
        await Promise.allSettled([
          fetch(`/api/sports?date=${today}`).then((r) => r.json()),
          fetch("/api/calendar").then((r) => r.json()),
          fetch("/api/events").then((r) => r.json()),
          fetch(`/api/holidays?date=${today}`).then((r) => r.json()),
          fetch("/api/menu").then((r) => r.json()),
        ]);

      if (sportsRes.status === "fulfilled") {
        const games: SportsGame[] = sportsRes.value.games || [];
        setThunderGame(games.find((g) => g.isThunder));
        setTvGames(
          games.filter(
            (g) =>
              !g.isThunder &&
              new Date(g.time) >= todayStart &&
              new Date(g.time) < todayEnd
          )
        );
      }
      if (calendarRes.status === "fulfilled") {
        setCalendarEvents(
          (calendarRes.value.events || []).filter((e: CalendarEvent) =>
            e.start.startsWith(today)
          )
        );
      }
      if (eventsRes.status === "fulfilled") {
        setLocalEvents(
          (eventsRes.value.events || []).filter((e: LocalEvent) => {
            const start = new Date(e.start);
            return start >= todayStart && start < todayEnd;
          })
        );
      }
      if (holidaysRes.status === "fulfilled")
        setHolidays(holidaysRes.value.today || []);
      if (menuRes.status === "fulfilled")
        setMenuData(menuRes.value.menu || { items: [], changes: [], lastUpdated: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const now = new Date();
  const newItemIds = new Set(
    menuData.changes.filter((c) => c.type === "added").map((c) => c.item.id)
  );

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading print sheet...</div>
    );
  }

  return (
    <div className="print-sheet bg-white text-black min-h-screen">
      {/* Print button - hidden in print */}
      <div className="no-print p-4 bg-gray-100 flex items-center justify-between">
        <button
          onClick={() => window.print()}
          className="bg-black text-white px-4 py-2 rounded text-sm font-medium"
        >
          Print This Sheet
        </button>
        <a href="/" className="text-sm text-gray-600 hover:text-black">
          Back to Dashboard
        </a>
      </div>

      <div className="p-6 max-w-[8in] mx-auto" style={{ fontSize: "11px" }}>
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-2 mb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wider">
            Cowboy Cold
          </h1>
          <p className="text-lg font-semibold">
            {format(now, "EEEE, MMMM d, yyyy")}
          </p>
          {holidays.length > 0 && (
            <p className="text-sm mt-1">
              {holidays.map((h) => `${h.emoji || ""} ${h.name}`).join(" | ")}
            </p>
          )}
        </div>

        {/* Thunder Game */}
        {thunderGame && (
          <div className="border-2 border-black p-3 mb-4">
            <div className="font-bold text-sm uppercase">
              OKC Thunder Game
            </div>
            <p>
              {thunderGame.homeTeam.toLowerCase().includes("thunder")
                ? `vs ${thunderGame.awayTeam}`
                : `@ ${thunderGame.homeTeam}`}{" "}
              &mdash; {format(new Date(thunderGame.time), "h:mm a")}
              {thunderGame.channel && ` on ${thunderGame.channel}`}
            </p>
          </div>
        )}

        {/* TV Sports */}
        {tvGames.length > 0 && (
          <div className="mb-4">
            <h2 className="font-bold text-sm uppercase border-b border-gray-400 mb-1">
              TV Sports
            </h2>
            <table className="w-full text-left" style={{ fontSize: "10px" }}>
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="py-0.5 pr-2">Time</th>
                  <th className="py-0.5 pr-2">Matchup</th>
                  <th className="py-0.5">Channel</th>
                </tr>
              </thead>
              <tbody>
                {tvGames.map((g) => (
                  <tr key={g.id} className="border-b border-gray-200">
                    <td className="py-0.5 pr-2 whitespace-nowrap">
                      {format(new Date(g.time), "h:mm a")}
                    </td>
                    <td className="py-0.5 pr-2">
                      {g.awayTeam} @ {g.homeTeam}
                    </td>
                    <td className="py-0.5">{g.channel || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tap List */}
        {menuData.items.length > 0 && (
          <div className="mb-4">
            <h2 className="font-bold text-sm uppercase border-b border-gray-400 mb-1">
              Current Tap List
            </h2>
            <div className="grid grid-cols-2 gap-x-4" style={{ fontSize: "10px" }}>
              {menuData.items.map((item) => (
                <div key={item.id} className="flex justify-between py-0.5 border-b border-gray-100">
                  <span>
                    {newItemIds.has(item.id) ? "* " : ""}
                    {item.name}
                    {item.style ? ` (${item.style})` : ""}
                  </span>
                  <span className="text-gray-600 ml-1">
                    {item.abv ? `${item.abv}%` : ""}
                  </span>
                </div>
              ))}
            </div>
            {newItemIds.size > 0 && (
              <p className="text-[9px] text-gray-500 mt-1">* = New today</p>
            )}
          </div>
        )}

        {/* Our Events */}
        {calendarEvents.length > 0 && (
          <div className="mb-4">
            <h2 className="font-bold text-sm uppercase border-b border-gray-400 mb-1">
              Our Events Today
            </h2>
            {calendarEvents.map((e) => (
              <p key={e.id} style={{ fontSize: "10px" }}>
                {format(new Date(e.start), "h:mm a")} &mdash; {e.summary}
              </p>
            ))}
          </div>
        )}

        {/* Local Events */}
        {localEvents.length > 0 && (
          <div className="mb-4">
            <h2 className="font-bold text-sm uppercase border-b border-gray-400 mb-1">
              Around OKC (May Affect Traffic)
            </h2>
            {localEvents.slice(0, 5).map((e) => (
              <p key={e.id} style={{ fontSize: "10px" }}>
                {e.name}
                {e.venue ? ` @ ${e.venue}` : ""}{" "}
                {e.start ? format(new Date(e.start), "h:mm a") : ""}
              </p>
            ))}
          </div>
        )}

        {/* Notes Section */}
        <div className="mt-4">
          <h2 className="font-bold text-sm uppercase border-b border-gray-400 mb-2">
            Notes
          </h2>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="border-b border-gray-300 h-5" />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-sheet {
            margin: 0;
            padding: 0;
          }
          @page {
            size: letter;
            margin: 0.5in;
          }
        }
      `}</style>
    </div>
  );
}
