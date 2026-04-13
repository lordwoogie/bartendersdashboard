import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import type { SportsGame } from "@/lib/types";
import { format } from "date-fns";

const CACHE_KEY = "sports-games";
const CACHE_TTL = 900; // 15 minutes

const THUNDER_TEAM_ID = "22"; // OKC Thunder NBA team ID

const ESPN_LEAGUES: Record<string, { sport: string; slug: string }> = {
  nba: { sport: "basketball", slug: "nba" },
  nfl: { sport: "football", slug: "nfl" },
  mlb: { sport: "baseball", slug: "mlb" },
  nhl: { sport: "hockey", slug: "nhl" },
  cfb: { sport: "football", slug: "college-football" },
  cbb: { sport: "basketball", slug: "mens-college-basketball" },
  mls: { sport: "soccer", slug: "usa.1" },
};

const FAVORITE_KEYWORDS = [
  "thunder",
  "sooners",
  "oklahoma",
  "cowboys",
  "okla",
  "okstate",
  "dallas cowboys",
];

function isPrimetime(dateStr: string): boolean {
  const d = new Date(dateStr);
  const hour = d.getHours();
  return hour >= 18 || hour === 0; // 6pm+ or midnight games
}

function isFavoriteTeam(name: string): boolean {
  const lower = name.toLowerCase();
  return FAVORITE_KEYWORDS.some((kw) => lower.includes(kw));
}

async function fetchESPNScoreboard(sport: string, slug: string, dateStr: string): Promise<SportsGame[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${slug}/scoreboard?dates=${dateStr}`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.events || []).map((event: Record<string, unknown>) => {
      const competition = (event.competitions as Record<string, unknown>[])?.[0];
      const competitors = (competition?.competitors as Record<string, unknown>[]) || [];
      const home = competitors.find((c) => (c.homeAway as string) === "home");
      const away = competitors.find((c) => (c.homeAway as string) === "away");
      const homeTeam = (home?.team as Record<string, string>)?.displayName || "TBD";
      const awayTeam = (away?.team as Record<string, string>)?.displayName || "TBD";
      const status = event.status as Record<string, unknown>;
      const statusType = status?.type as Record<string, unknown>;
      const isLive = (statusType?.state as string) === "in";
      const isCompleted = (statusType?.completed as boolean) || false;

      const broadcasts = (competition?.broadcasts as Record<string, unknown>[]) || [];
      const tvNames = broadcasts.flatMap(
        (b) => ((b.names as string[]) || [])
      );

      return {
        id: event.id as string,
        sport: slug,
        league: slug.toUpperCase(),
        homeTeam,
        awayTeam,
        time: event.date as string,
        channel: tvNames[0] || undefined,
        isLive,
        isCompleted,
        homeScore: isLive || isCompleted ? Number((home?.score as string) || 0) : undefined,
        awayScore: isLive || isCompleted ? Number((away?.score as string) || 0) : undefined,
        isThunder:
          homeTeam.toLowerCase().includes("thunder") ||
          awayTeam.toLowerCase().includes("thunder"),
        isFavorite: isFavoriteTeam(homeTeam) || isFavoriteTeam(awayTeam),
        isPrimetime: isPrimetime(event.date as string),
      } satisfies SportsGame;
    });
  } catch (err) {
    console.error(`ESPN fetch error for ${slug}:`, err);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  const dateStr = format(targetDate, "yyyyMMdd");

  const cacheKey = `${CACHE_KEY}-${dateStr}`;
  const cached = getCached<SportsGame[]>(cacheKey);
  if (cached) return NextResponse.json({ games: cached, cached: true });

  // Fetch from all ESPN leagues in parallel
  const promises = Object.entries(ESPN_LEAGUES).map(([, { sport, slug }]) =>
    fetchESPNScoreboard(sport, slug, dateStr)
  );
  const results = await Promise.all(promises);
  const allGames = results.flat();

  // Sort: Thunder first, then favorites, then by time
  allGames.sort((a, b) => {
    if (a.isThunder && !b.isThunder) return -1;
    if (!a.isThunder && b.isThunder) return 1;
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });

  setCache(cacheKey, allGames, CACHE_TTL);
  return NextResponse.json({ games: allGames });
}
