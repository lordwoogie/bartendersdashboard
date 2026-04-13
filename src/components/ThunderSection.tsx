"use client";

import type { SportsGame } from "@/lib/types";
import { format } from "date-fns";

export function ThunderSection({ game }: { game?: SportsGame }) {
  if (!game) {
    return (
      <div className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
        <h2 className="text-lg font-semibold text-muted flex items-center gap-2">
          <span className="text-2xl">🏀</span> No Thunder game today
        </h2>
      </div>
    );
  }

  const gameTime = new Date(game.time);
  const timeStr = format(gameTime, "h:mm a");
  const isHome = game.homeTeam.toLowerCase().includes("thunder");

  return (
    <div className="rounded-xl border-2 border-thunder-blue bg-gradient-to-r from-[#001f3f] to-[#003366] p-6 mb-6 relative overflow-hidden">
      {/* Subtle thunder bolt pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-5 text-[8rem] leading-none pointer-events-none">
        ⚡
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚡</span>
            <h2 className="text-xl font-bold text-white">OKC Thunder</h2>
            {game.isLive && (
              <span className="animate-pulse-live bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                LIVE
              </span>
            )}
          </div>

          <p className="text-thunder-blue text-lg font-semibold">
            {isHome
              ? `vs ${game.awayTeam}`
              : `@ ${game.homeTeam}`}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {isHome ? "Home" : "Away"} &middot; {timeStr}
            {game.channel && ` &middot; ${game.channel}`}
          </p>
        </div>

        {(game.isLive || game.isCompleted) &&
          game.homeScore !== undefined &&
          game.awayScore !== undefined && (
            <div className="text-center">
              <div className="text-3xl font-bold text-white tabular-nums">
                {isHome
                  ? `${game.homeScore} - ${game.awayScore}`
                  : `${game.awayScore} - ${game.homeScore}`}
              </div>
              {game.isCompleted && (
                <p className="text-gray-400 text-sm mt-1">Final</p>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
