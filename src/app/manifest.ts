import type { MetadataRoute } from "next";

// Web app manifest so the dashboard installs as a standalone app on the
// taproom tablet (Add to Home screen -> fullscreen, no browser chrome).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lively Bartender Dashboard",
    short_name: "Bar Dashboard",
    description:
      "Daily briefing, inventory logging, and duty checklists for the taproom.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    // Lively paper ground behind the splash screen; Lively Green to match
    // the header bar (same values as --paper-2 / --lively-green in globals.css).
    background_color: "#f7f6f1",
    theme_color: "#2b6d57",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
