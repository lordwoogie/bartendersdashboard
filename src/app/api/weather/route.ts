import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import type { WeatherData } from "@/lib/types";

const CACHE_KEY = "weather";
const CACHE_TTL = 1800; // 30 minutes
const OKC_LAT = 35.4634;
const OKC_LNG = -97.5151;

export async function GET() {
  const cached = getCached<WeatherData>(CACHE_KEY);
  if (cached) return NextResponse.json({ weather: cached, cached: true });

  const key = process.env.OPENWEATHERMAP_API_KEY;
  if (!key) {
    return NextResponse.json({
      weather: null,
      error: "Configure OPENWEATHERMAP_API_KEY",
    });
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${OKC_LAT}&lon=${OKC_LNG}&appid=${key}&units=imperial`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenWeather API ${res.status}`);
    const data = await res.json();

    const weather: WeatherData = {
      temp: Math.round(data.main.temp),
      high: Math.round(data.main.temp_max),
      low: Math.round(data.main.temp_min),
      condition: data.weather[0]?.main || "Unknown",
      icon: data.weather[0]?.icon || "01d",
      description: data.weather[0]?.description || "",
    };

    setCache(CACHE_KEY, weather, CACHE_TTL);
    return NextResponse.json({ weather });
  } catch (err) {
    console.error("Weather API error:", err);
    return NextResponse.json({ weather: null, error: "Failed to fetch weather" }, { status: 500 });
  }
}
