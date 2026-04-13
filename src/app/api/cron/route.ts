import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;

  try {
    const res = await fetch(`${baseUrl}/api/send-briefing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const result = await res.json();

    if (res.ok) {
      return NextResponse.json({ success: true, result });
    } else {
      return NextResponse.json(
        { error: "Failed to send briefing", details: result },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Cron trigger error:", err);
    return NextResponse.json(
      { error: "Cron trigger failed" },
      { status: 500 }
    );
  }
}
