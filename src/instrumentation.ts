import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Reports every uncaught server-side error (route handlers, server
// components, actions) to Sentry with its request context.
export const onRequestError = Sentry.captureRequestError;
