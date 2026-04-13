import { NextResponse } from "next/server";
import { Resend } from "resend";
import { fetchBriefingData } from "@/lib/briefing";
import { generateEmailHtml, generateEmailSubject } from "@/lib/email-template";

export async function POST(request: Request) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "Configure RESEND_API_KEY" },
      { status: 500 }
    );
  }

  const recipients = process.env.EMAIL_RECIPIENTS?.split(",").map((e) =>
    e.trim()
  );
  if (!recipients || recipients.length === 0) {
    return NextResponse.json(
      { error: "Configure EMAIL_RECIPIENTS" },
      { status: 500 }
    );
  }

  // Allow overriding recipients for test sends
  let targetRecipients = recipients;
  try {
    const body = await request.json();
    if (body.testEmail) {
      targetRecipients = [body.testEmail];
    }
  } catch {
    // No body = use default recipients
  }

  const baseUrl = new URL(request.url).origin;

  try {
    const data = await fetchBriefingData(baseUrl);
    const html = generateEmailHtml(data);
    const subject = generateEmailSubject(data);

    const resend = new Resend(resendKey);
    const result = await resend.emails.send({
      from: "Cowboy Cold <briefing@resend.dev>",
      to: targetRecipients,
      subject,
      html,
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Send briefing error:", err);
    return NextResponse.json(
      { error: "Failed to send briefing email" },
      { status: 500 }
    );
  }
}
