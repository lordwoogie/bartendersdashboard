import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // The public livelybeerworks.com homepage is a self-contained static
      // bundle exported from the Claude Design handoff (public/index.html,
      // with public/map.html and public/assets/ alongside it). It has no
      // React page, so map "/" onto it before any app route is considered.
      // The bartender tools live under /dashboard and the other app routes.
      beforeFiles: [{ source: "/", destination: "/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

// No auth token is configured, so source-map upload is skipped — Sentry
// still receives every error, just with minified stack traces.
export default withSentryConfig(nextConfig, {
  silent: true,
});
