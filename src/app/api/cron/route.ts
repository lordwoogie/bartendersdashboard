import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;

  // Fire both morning emails; one failing shouldn't block the other.
  const call = async (path: string) => {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return { ok: res.ok, body: await res.json() };
    } catch (err) {
      console.error(`Cron call ${path} failed:`, err);
      return { ok: false, body: { error: String(err) } };
    }
  };

  const [briefing, inventoryDigest] = await Promise.all([
    call("/api/send-briefing"),
    call("/api/send-inventory-digest"),
  ]);

  const allOk = briefing.ok && inventoryDigest.ok;
  return NextResponse.json(
    {
      success: allOk,
      briefing: briefing.body,
      inventoryDigest: inventoryDigest.body,
    },
    { status: allOk ? 200 : 500 }
  );
}
