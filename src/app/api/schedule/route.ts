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

export interface DeputyMemo {
  id: number;
  content: string;
  creator: string;
  created: string;
}

interface ScheduleData {
  shifts: DeputyShift[];
  latestPost: DeputyMemo | null;
}

function getAuthHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.DEPUTY_ACCESS_TOKEN}`,
  };
}

async function fetchDeputyRoster(days: number): Promise<DeputyShift[]> {
  const baseUrl = process.env.DEPUTY_BASE_URL;
  if (!baseUrl) return [];

  try {
    const now = Math.floor(Date.now() / 1000);
    const future = now + days * 86400;

    const res = await fetch(`${baseUrl}/api/v1/resource/Roster/QUERY`, {
      method: "POST",
      headers: getAuthHeaders(),
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
      console.error("Deputy roster error:", res.status);
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
    console.error("Deputy roster fetch error:", err);
    return [];
  }
}

async function fetchLatestMemo(): Promise<DeputyMemo | null> {
  const baseUrl = process.env.DEPUTY_BASE_URL;
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/api/v1/resource/Memo/QUERY`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        sort: { Created: "desc" },
        max: 1,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const memo = data[0];
    const created = memo.Created as string;

    // Check if the memo is within 10 days
    const memoDate = new Date(created);
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    if (memoDate < tenDaysAgo) return null;

    const creatorInfo = memo._DPMetaData?.CreatorInfo as Record<string, unknown> | undefined;

    return {
      id: memo.Id as number,
      content: (memo.Content as string) || "",
      creator: (creatorInfo?.DisplayName as string) || "Unknown",
      created,
    };
  } catch (err) {
    console.error("Deputy memo fetch error:", err);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  const cacheKey = `${CACHE_KEY}-${days}`;
  const cached = getCached<ScheduleData>(cacheKey);
  if (cached) return NextResponse.json(cached);

  if (!process.env.DEPUTY_BASE_URL || !process.env.DEPUTY_ACCESS_TOKEN) {
    return NextResponse.json({
      shifts: [],
      latestPost: null,
      error: "Configure DEPUTY_BASE_URL and DEPUTY_ACCESS_TOKEN",
    });
  }

  const [shifts, latestPost] = await Promise.all([
    fetchDeputyRoster(days),
    fetchLatestMemo(),
  ]);

  const result: ScheduleData = { shifts, latestPost };
  setCache(cacheKey, result, CACHE_TTL);
  return NextResponse.json(result);
}
