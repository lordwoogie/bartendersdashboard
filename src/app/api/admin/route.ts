import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/storage";

const CONFIG_DOC = "admin-config.json";
const HOLIDAYS_DOC = "drinking-holidays.json";

type Role = "admin" | "editor";

interface ManualEvent {
  id: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface AdminConfig {
  manualEvents?: ManualEvent[];
  emailRecipients?: string[];
  [key: string]: unknown;
}

interface Holiday {
  date: string;
  name: string;
  emoji?: string;
  recurring?: boolean;
}

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
function configForRole(config: AdminConfig, role: Role) {
  if (role === "editor") {
    return { manualEvents: config.manualEvents || [] };
  }
  return config;
}

// GET: fetch admin config and holidays. Admins get the full config; editors
// only receive the event data they are allowed to manage.
export async function GET(request: Request) {
  const role = getRole(request);
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await readData<AdminConfig>(CONFIG_DOC);

    if (role === "editor") {
      return NextResponse.json({
        role,
        config: { manualEvents: config.manualEvents || [] },
        holidays: [],
      });
    }

    const holidays = await readData<Holiday[]>(HOLIDAYS_DOC);
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
      const config = await readData<AdminConfig>(CONFIG_DOC);
      Object.assign(config, body.config);
      await writeData(CONFIG_DOC, config);
      return NextResponse.json({ success: true, config });
    }

    if (action === "update-holidays") {
      await writeData(HOLIDAYS_DOC, body.holidays);
      return NextResponse.json({ success: true });
    }

    if (action === "add-holiday") {
      const holidays = await readData<Holiday[]>(HOLIDAYS_DOC);
      holidays.push(body.holiday);
      await writeData(HOLIDAYS_DOC, holidays);
      return NextResponse.json({ success: true, holidays });
    }

    if (action === "remove-holiday") {
      const holidays = await readData<Holiday[]>(HOLIDAYS_DOC);
      const filtered = holidays.filter(
        (h) => !(h.date === body.date && h.name === body.name)
      );
      await writeData(HOLIDAYS_DOC, filtered);
      return NextResponse.json({ success: true, holidays: filtered });
    }

    if (action === "add-manual-event") {
      const config = await readData<AdminConfig>(CONFIG_DOC);
      if (!config.manualEvents) config.manualEvents = [];
      config.manualEvents.push({
        ...body.event,
        id: `manual-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      await writeData(CONFIG_DOC, config);
      return NextResponse.json({ success: true, config: configForRole(config, role) });
    }

    if (action === "update-manual-event") {
      const config = await readData<AdminConfig>(CONFIG_DOC);
      const events = config.manualEvents || [];
      const index = events.findIndex((e) => e.id === body.eventId);
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
      await writeData(CONFIG_DOC, config);
      return NextResponse.json({ success: true, config: configForRole(config, role) });
    }

    if (action === "remove-manual-event") {
      const config = await readData<AdminConfig>(CONFIG_DOC);
      config.manualEvents = (config.manualEvents || []).filter(
        (e) => e.id !== body.eventId
      );
      await writeData(CONFIG_DOC, config);
      return NextResponse.json({ success: true, config: configForRole(config, role) });
    }

    if (action === "update-recipients") {
      const config = await readData<AdminConfig>(CONFIG_DOC);
      config.emailRecipients = body.recipients;
      await writeData(CONFIG_DOC, config);
      return NextResponse.json({ success: true, config });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Admin POST error:", err);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
