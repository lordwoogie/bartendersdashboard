import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// No auth token is configured, so source-map upload is skipped — Sentry
// still receives every error, just with minified stack traces.
export default withSentryConfig(nextConfig, {
  silent: true,
});
