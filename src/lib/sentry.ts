// Sentry error monitoring — shared settings for the server, edge, and
// browser inits. The DSN is a public identifier (it ships in the client
// bundle by design); an env var can override it without a code change.
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  "https://138fb085f215850c0d1104adbf6bb0f9@o4511950312833024.ingest.us.sentry.io/4511950328496128";

export const SENTRY_BASE_OPTIONS = {
  dsn: SENTRY_DSN,
  // Errors only — no performance tracing, so the free-plan quota is spent
  // entirely on crashes and failed requests.
  tracesSampleRate: 0,
  // Local dev and test runs shouldn't pollute the production issue feed.
  enabled: process.env.NODE_ENV === "production",
} as const;
