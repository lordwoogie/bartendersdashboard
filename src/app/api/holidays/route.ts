import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import { format } from "date-fns";
import type { Holiday } from "@/lib/types";
import drinkingHolidays from "@/data/drinking-holidays.json";

const CACHE_KEY = "holidays";
const CACHE_TTL = 86400; // 24 hours

async function fetchPublicHolidays(year: number): Promise<Holiday[]> {
  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/US`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data as Record<string, string>[]).map((h) => ({
      date: h.date,
      name: h.localName || h.name,
      type: "public" as const,
    }));
  } catch {
    return [];
  }
}

function getCustomHolidays(dateStr: string): Holiday[] {
  const mmdd = dateStr.slice(5); // "MM-DD" from "YYYY-MM-DD"
  return (drinkingHolidays as Array<{ date: string; name: string; emoji?: string; recurring?: boolean }>)
    .filter((h) => h.date === mmdd)
    .map((h) => ({
      date: dateStr,
      name: h.name,
      emoji: h.emoji,
      type: "drinking" as const,
      recurring: h.recurring,
    }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  const dateStr = format(targetDate, "yyyy-MM-dd");
  const year = targetDate.getFullYear();

  const cacheKey = `${CACHE_KEY}-${year}`;
  let publicHolidays = getCached<Holiday[]>(cacheKey);

  if (!publicHolidays) {
    publicHolidays = await fetchPublicHolidays(year);
    setCache(cacheKey, publicHolidays, CACHE_TTL);
  }

  const todaysPublic = publicHolidays.filter((h) => h.date === dateStr);
  const todaysCustom = getCustomHolidays(dateStr);

  const allHolidays = [...todaysPublic, ...todaysCustom];

  // Also return week's holidays for the "week ahead" view
  const weekHolidays: Holiday[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() + i);
    const ds = format(d, "yyyy-MM-dd");
    weekHolidays.push(
      ...publicHolidays.filter((h) => h.date === ds),
      ...getCustomHolidays(ds)
    );
  }

  return NextResponse.json({
    today: allHolidays,
    week: weekHolidays,
  });
}
