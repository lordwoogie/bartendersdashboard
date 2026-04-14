import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import type { WeatherData } from "@/lib/types";

const CACHE_KEY = "weather";
const CACHE_TTL = 1800; // 30 minutes

// NWS grid point for Cowboy Cold (815 SW 2nd St, OKC)
// To find yours: https://api.weather.gov/points/LAT,LNG
const NWS_OFFICE = "OUN"; // Norman, OK forecast office
const NWS_GRID_X = 41;
const NWS_GRID_Y = 35;

const UA = "CowboyColdBriefing/1.0 (cowboycold@livelybeer.com)";

function weatherEmoji(forecast: string): string {
  const f = forecast.toLowerCase();
  if (f.includes("thunder") || f.includes("storm")) return "⛈️";
  if (f.includes("rain") || f.includes("shower") || f.includes("drizzle")) return "🌧️";
  if (f.includes("snow") || f.includes("sleet") || f.includes("ice")) return "🌨️";
  if (f.includes("fog") || f.includes("mist") || f.includes("haze")) return "🌫️";
  if (f.includes("cloud") || f.includes("overcast")) return "☁️";
  if (f.includes("partly")) return "⛅";
  if (f.includes("wind")) return "💨";
  if (f.includes("hot")) return "🔥";
  if (f.includes("sunny") || f.includes("clear")) return "☀️";
  return "🌤️";
}

export async function GET() {
  const cached = getCached<WeatherData>(CACHE_KEY);
  if (cached) return NextResponse.json({ weather: cached, cached: true });

  try {
    // NWS forecast endpoint — no API key needed
    const forecastUrl = `https://api.weather.gov/gridpoints/${NWS_OFFICE}/${NWS_GRID_X},${NWS_GRID_Y}/forecast`;
    const res = await fetch(forecastUrl, {
      headers: { "User-Agent": UA, Accept: "application/geo+json" },
    });
    if (!res.ok) throw new Error(`NWS API ${res.status}`);
    const data = await res.json();

    const periods = data.properties?.periods || [];
    if (periods.length === 0) throw new Error("No forecast periods");

    // Current period (today daytime or tonight)
    const current = periods[0];
    // Find today's daytime and tonight for high/low
    const daytime = periods.find((p: { isDaytime: boolean }) => p.isDaytime);
    const nighttime = periods.find((p: { isDaytime: boolean }) => !p.isDaytime);

    const weather: WeatherData = {
      temp: current.temperature,
      high: daytime?.temperature ?? current.temperature,
      low: nighttime?.temperature ?? current.temperature,
      condition: current.shortForecast || "Unknown",
      icon: weatherEmoji(current.shortForecast || ""),
      description: current.detailedForecast || current.shortForecast || "",
    };

    setCache(CACHE_KEY, weather, CACHE_TTL);
    return NextResponse.json({ weather });
  } catch (err) {
    console.error("NWS Weather API error:", err);
    return NextResponse.json(
      { weather: null, error: "Failed to fetch weather" },
      { status: 500 }
    );
  }
}
