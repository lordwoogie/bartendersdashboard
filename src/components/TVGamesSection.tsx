"use client";

import type { SportsGame } from "@/lib/types";
import { format } from "date-fns";

const SPORT_ICONS: Record<string, string> = {
  nba: "🏀",
  nfl: "🏈",
  mlb: "⚾",
  nhl: "🏒",
  "college-football": "🏈",
  "mens-college-basketball": "🏀",
  "usa.1": "⚽",
  "eng.1": "⚽",
  "uefa.champions": "⚽",
  "fifa.world": "⚽",
};

export function TVGamesSection({ games }: { games: SportsGame[] }) {
  if (games.length === 0) {
    return (
      <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
        <h2 className="text-lg font-semibold text-amber flex items-center gap-2">
          <span className="text-xl">📺</span> What&apos;s On TV
        </h2>
        <p className="text-muted mt-2 text-sm">No major games on TV today.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
      <h2 className="text-lg font-semibold text-amber flex items-center gap-2 mb-4">
        <span className="text-xl">📺</span> What&apos;s On TV
        <span className="text-xs text-muted font-normal">
          ({games.length} game{games.length !== 1 ? "s" : ""})
        </span>
      </h2>

      <div className="grid gap-2">
        {games.map((game) => {
          const icon = SPORT_ICONS[game.sport] || "🏅";
          const time = format(new Date(game.time), "h:mm a");

          return (
            <div
              key={game.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                game.isPrimetime
                  ? "bg-surface border border-amber/20"
                  : "bg-surface/50"
              } ${game.isFavorite ? "border-l-2 border-l-copper" : ""}`}
            >
              <span className="text-lg shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {game.awayTeam} @ {game.homeTeam}
                </p>
                <p className="text-xs text-muted">
                  {game.league
                    .replace("COLLEGE-FOOTBALL", "CFB")
                    .replace("MENS-COLLEGE-BASKETBALL", "CBB")
                    .replace("ENG.1", "EPL")
                    .replace("UEFA.CHAMPIONS", "UCL")
                    .replace("FIFA.WORLD", "World Cup")
                    .replace("USA.1", "MLS")}
                </p>
              </div>
              <div className="text-right shrink-0">
                {game.isLive ? (
                  <div className="flex items-center gap-1">
                    <span className="animate-pulse-live w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-sm font-bold text-white">
                      {game.awayScore}-{game.homeScore}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-foreground">{time}</p>
                )}
                {game.channel && (
                  <p className="text-xs text-amber font-medium">{game.channel}</p>
                )}
              </div>
              {game.isPrimetime && (
                <span className="text-[10px] bg-amber/20 text-amber px-1.5 py-0.5 rounded font-medium uppercase tracking-wider shrink-0">
                  PT
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
