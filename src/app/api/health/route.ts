import { NextResponse } from "next/server";

export async function GET() {
  const services = {
    googleCalendar: !!process.env.GOOGLE_CALENDAR_ID && !!process.env.GOOGLE_PRIVATE_KEY,
    untappd: !!process.env.UNTAPPD_API_KEY,
    predictHQ: !!process.env.PREDICTHQ_API_KEY,
    eventbrite: !!process.env.EVENTBRITE_API_KEY,
    openWeather: !!process.env.OPENWEATHERMAP_API_KEY,
    resend: !!process.env.RESEND_API_KEY,
  };

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services,
  });
}
