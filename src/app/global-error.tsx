"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort error screen: shown only when the root layout itself crashes.
// It replaces the entire page, so it must render its own <html>/<body> and
// can't rely on the app's stylesheet — styles are inline.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1410",
          color: "#f5efe6",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ opacity: 0.8, marginBottom: "1.25rem" }}>
            The error has been reported. Try reloading — if it keeps happening,
            let Nick know.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#f59e0b",
              color: "#1a1410",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.6rem 1.4rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
