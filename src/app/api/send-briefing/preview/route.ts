import { NextResponse } from "next/server";
import { fetchBriefingData } from "@/lib/briefing";
import { generateEmailHtml } from "@/lib/email-template";

export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin;

  try {
    const data = await fetchBriefingData(baseUrl);
    const html = generateEmailHtml(data);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
