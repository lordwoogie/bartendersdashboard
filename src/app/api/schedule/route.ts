import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";

const CACHE_KEY = "deputy-schedule";
const CACHE_TTL = 900; // 15 minutes

export interface DeputyShift {
  id: number;
  employee: string;
  area: string;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  published: boolean;
}

async function fetchDeputyRoster(days: number): Promise<DeputyShift[]> {
  const baseUrl = process.env.DEPUTY_BASE_URL;
  const token = process.env.DEPUTY_ACCESS_TOKEN;
  if (!baseUrl || !token) return [];

  try {
    const now = Math.floor(Date.now() / 1000);
    const future = now + days * 86400;

    const res = await fetch(`${baseUrl}/api/v1/resource/Roster/QUERY`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        search: {
          s1: { field: "StartTime", data: now, type: "ge" },
          s2: { field: "StartTime", data: future, type: "le" },
        },
        join: ["EmployeeObject", "OperationalUnitObject"],
        sort: { StartTime: "asc" },
        max: 200,
      }),
    });

    if (!res.ok) {
      console.error("Deputy API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();

    return (data as Record<string, unknown>[]).map((r) => {
      const emp = r.EmployeeObject as Record<string, unknown> | null;
      const unit = r.OperationalUnitObject as Record<string, unknown> | null;

      return {
        id: r.Id as number,
        employee: (emp?.DisplayName as string) || "Unassigned",
        area: (unit?.OperationalUnitName as string) || "General",
        date: (r.Date as string) || "",
        startTime: (r.StartTimeLocalized as string) || "",
        endTime: (r.EndTimeLocalized as string) || "",
        totalHours: (r.TotalTime as number) || 0,
        published: (r.Published as boolean) || false,
      };
    });
  } catch (err) {
    console.error("Deputy fetch error:", err);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  const cacheKey = `${CACHE_KEY}-${days}`;
  const cached = getCached<DeputyShift[]>(cacheKey);
  if (cached) return NextResponse.json({ shifts: cached, cached: true });

  if (!process.env.DEPUTY_BASE_URL || !process.env.DEPUTY_ACCESS_TOKEN) {
    return NextResponse.json({
      shifts: [],
      error: "Configure DEPUTY_BASE_URL and DEPUTY_ACCESS_TOKEN",
    });
  }

  const shifts = await fetchDeputyRoster(days);
  setCache(cacheKey, shifts, CACHE_TTL);
  return NextResponse.json({ shifts });
}
