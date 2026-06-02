import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "src/data/admin-config.json");
const HOLIDAYS_PATH = path.join(process.cwd(), "src/data/drinking-holidays.json");

type Role = "admin" | "editor";

// Actions an "editor" is allowed to perform. Editors can manage event
// details only — everything else requires full admin access.
const EVENT_DETAIL_ACTIONS = new Set([
  "add-manual-event",
  "update-manual-event",
  "remove-manual-event",
]);

// Resolve the caller's role from the password header. Returns null when the
// supplied password matches neither the admin nor the event-editor password.
// The editor role is only available when EVENT_EDITOR_PASSWORD is configured.
function getRole(request: Request): Role | null {
  const auth = request.headers.get("x-admin-password");
  if (!auth) return null;

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword && auth === adminPassword) return "admin";

  const editorPassword = process.env.EVENT_EDITOR_PASSWORD;
  if (editorPassword && auth === editorPassword) return "editor";

  return null;
}

// Shape the config returned to a caller so editors never receive admin-only
// fields (sports settings, email recipients) in a response body.
function configForRole(config: { manualEvents?: unknown }, role: Role) {
  if (role === "editor") {
    return { manualEvents: config.manualEvents || [] };
  }
  return config;
}

async function readJson(filePath: string) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function writeJson(filePath: string, data: unknown) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// GET: fetch admin config and holidays. Admins get the full config; editors
// only receive the event data they are allowed to manage.
export async function GET(request: Request) {
  const role = getRole(request);
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await readJson(CONFIG_PATH);

    if (role === "editor") {
      return NextResponse.json({
        role,
        config: { manualEvents: config.manualEvents || [] },
        holidays: [],
      });
    }

    const holidays = await readJson(HOLIDAYS_PATH);
    return NextResponse.json({ role, config, holidays });
  } catch (err) {
    console.error("Admin GET error:", err);
    return NextResponse.json({ error: "Failed to read config" }, { status: 500 });
  }
}

// POST: update config. Event-detail actions are available to admins and
// editors; all other actions require full admin access.
export async function POST(request: Request) {
  const role = getRole(request);
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (role === "editor" && !EVENT_DETAIL_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "Forbidden: editors may only manage event details" },
        { status: 403 }
      );
    }

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
      return NextResponse.json({ success: true, config: configForRole(config, role) });
    }

    if (action === "update-manual-event") {
      const config = await readJson(CONFIG_PATH);
      const events = config.manualEvents || [];
      const index = events.findIndex(
        (e: { id: string }) => e.id === body.eventId
      );
      if (index === -1) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      const existing = events[index];
      events[index] = {
        ...existing,
        ...body.event,
        // Preserve immutable identity/audit fields.
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      config.manualEvents = events;
      await writeJson(CONFIG_PATH, config);
      return NextResponse.json({ success: true, config: configForRole(config, role) });
    }

    if (action === "remove-manual-event") {
      const config = await readJson(CONFIG_PATH);
      config.manualEvents = (config.manualEvents || []).filter(
        (e: { id: string }) => e.id !== body.eventId
      );
      await writeJson(CONFIG_PATH, config);
      return NextResponse.json({ success: true, config: configForRole(config, role) });
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
