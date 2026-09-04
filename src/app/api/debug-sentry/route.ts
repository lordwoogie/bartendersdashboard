export const dynamic = "force-dynamic";

// Intentionally throws so the Sentry wiring can be verified end-to-end:
// hitting this route should produce a 500 here and an event in Sentry.
export async function GET() {
  throw new Error("Sentry wiring test — this error is intentional");
}
