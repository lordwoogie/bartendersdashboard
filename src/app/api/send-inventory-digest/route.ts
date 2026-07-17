import { NextResponse } from "next/server";
import { Resend } from "resend";
import { readData } from "@/lib/storage";
import type { InventoryEntry } from "@/lib/inventory";
import { digestHtml } from "@/lib/inventory-report";
import { dateKeyInZone, formatDateLabel } from "@/lib/timezone";

const LOG_DOC = "inventory-log.json";

// POST /api/send-inventory-digest — email yesterday's inventory activity
// (kegs on / kegs off / cases in) the morning after it was logged. Called by
// the daily cron alongside the briefing. Skips silently when yesterday had
// no activity so quiet days don't send empty emails.
// Body (optional): { testEmail: "x@y.com", date: "YYYY-MM-DD" }
export async function POST(request: Request) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "Configure RESEND_API_KEY" }, { status: 500 });
  }

  const recipients = process.env.EMAIL_RECIPIENTS?.split(",").map((e) => e.trim());
  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: "Configure EMAIL_RECIPIENTS" }, { status: 500 });
  }

  let targetRecipients = recipients;
  let targetDay: string | undefined;
  try {
    const body = await request.json();
    if (body.testEmail) targetRecipients = [body.testEmail];
    if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      targetDay = body.date;
    }
  } catch {
    // no body — defaults
  }

  // Default: yesterday's calendar day in the venue timezone. The cron fires
  // early morning, so now-24h lands squarely on yesterday.
  if (!targetDay) {
    targetDay = dateKeyInZone(new Date(Date.now() - 24 * 60 * 60 * 1000));
  }

  try {
    const log = await readData<InventoryEntry[]>(LOG_DOC);
    const dayEntries = log
      .filter((e) => dateKeyInZone(new Date(e.timestamp)) === targetDay)
      .sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

    if (dayEntries.length === 0) {
      return NextResponse.json({ skipped: true, reason: "no activity", date: targetDay });
    }

    const dayLabel = formatDateLabel(targetDay);
    const resend = new Resend(resendKey);
    const result = await resend.emails.send({
      // Override with EMAIL_FROM once a domain is verified in Resend.
      from: process.env.EMAIL_FROM || "Lively Beerworks <inventory@resend.dev>",
      to: targetRecipients,
      subject: `🛢 Inventory: ${dayEntries.length} change${dayEntries.length === 1 ? "" : "s"} — ${dayLabel}`,
      html: digestHtml(dayEntries, dayLabel),
    });

    return NextResponse.json({ success: true, count: dayEntries.length, date: targetDay, result });
  } catch (err) {
    console.error("Send inventory digest error:", err);
    return NextResponse.json({ error: "Failed to send inventory digest" }, { status: 500 });
  }
}
