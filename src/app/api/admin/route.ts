import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "src/data/admin-config.json");
const HOLIDAYS_PATH = path.join(process.cwd(), "src/data/drinking-holidays.json");

function checkAuth(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const auth = request.headers.get("x-admin-password");
  return auth === password;
}

async function readJson(filePath: string) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function writeJson(filePath: string, data: unknown) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// GET: fetch admin config and holidays
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await readJson(CONFIG_PATH);
    const holidays = await readJson(HOLIDAYS_PATH);
    return NextResponse.json({ config, holidays });
  } catch (err) {
    console.error("Admin GET error:", err);
    return NextResponse.json({ error: "Failed to read config" }, { status: 500 });
  }
}

// POST: update config
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "update-config") {
      const config = await readJson(CONFIG_PATH);
      Object.assign(config, body.config);
      await writeJson(CONFIG_PATH, config);
      return NextResponse.json({ success: true, config });
    }

    if (action === "update-holidays") {
      await writeJson(HOLIDAYS_PATH, body.holidays);
      return NextResponse.json({ success: true });
    }

    if (action === "add-holiday") {
      const holidays = await readJson(HOLIDAYS_PATH);
      holidays.push(body.holiday);
      await writeJson(HOLIDAYS_PATH, holidays);
      return NextResponse.json({ success: true, holidays });
    }

    if (action === "remove-holiday") {
      const holidays = await readJson(HOLIDAYS_PATH);
      const filtered = holidays.filter(
        (h: { date: string; name: string }) =>
          !(h.date === body.date && h.name === body.name)
      );
      await writeJson(HOLIDAYS_PATH, filtered);
      return NextResponse.json({ success: true, holidays: filtered });
    }

    if (action === "add-manual-event") {
      const config = await readJson(CONFIG_PATH);
      if (!config.manualEvents) config.manualEvents = [];
      config.manualEvents.push({
        ...body.event,
        id: `manual-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      await writeJson(CONFIG_PATH, config);
      return NextResponse.json({ success: true, config });
    }

    if (action === "remove-manual-event") {
      const config = await readJson(CONFIG_PATH);
      config.manualEvents = (config.manualEvents || []).filter(
        (e: { id: string }) => e.id !== body.eventId
      );
      await writeJson(CONFIG_PATH, config);
      return NextResponse.json({ success: true, config });
    }

    if (action === "update-recipients") {
      const config = await readJson(CONFIG_PATH);
      config.emailRecipients = body.recipients;
      await writeJson(CONFIG_PATH, config);
      return NextResponse.json({ success: true, config });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Admin POST error:", err);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
