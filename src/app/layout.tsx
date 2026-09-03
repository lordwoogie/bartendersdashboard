import type { Metadata, Viewport } from "next";
import "./globals.css";

// The brand typeface (Platform) is self-hosted from public/fonts and declared
// with @font-face in globals.css; `font-sans` maps to that stack via the
// @theme block, so the body picks it up without next/font.

export const metadata: Metadata = {
  title: "Lively Bartender Dashboard",
  description:
    "Daily briefing dashboard for the taproom — OKC Thunder, TV sports, local events, and tap list.",
};

// Colors the Android status bar to match the green header bar when installed
// to the home screen.
export const viewport: Viewport = {
  themeColor: "#2b6d57",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
