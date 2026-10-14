// Where a game is actually watchable in the taproom.
//
// Staff ask the same question every time a game comes on: cable box or
// Apple TV? ESPN's feed gives us a single broadcaster name — "ESPN",
// "Paramount+", "Apple TV", "NBA TV" — so we classify that name rather
// than guess from the league.
//
// Real values seen in the feed: ESPN, ABC, NBC, FOX, CBS, TNT, FS1, CBSSN,
// NBA TV, ESPN+, Paramount+, Apple TV, Peacock, Prime Video.

export type WatchOn = "cable" | "streaming" | "unknown";

// Services that live in an app on the Apple TV, not on the cable box.
// Matched case-insensitively against the whole channel name.
const STREAMING = [
  "peacock",
  "prime video",
  "amazon",
  "apple tv",
  "netflix",
  "max",
  "hbo",
  "hulu",
  "disney+",
  "espn+",
  "paramount+",
  "fubo",
  "youtube tv",
  "youtube",
  "league pass",
  "nfl+",
  "mlb.tv",
  "sling",
];

// Cable channels that happen to contain a streaming keyword ("ESPN" is
// cable, "ESPN+" is not), so an exact match wins before the keyword scan.
const CABLE_EXACT = ["espn", "espn2", "espnu", "espnews", "nba tv", "mlb network", "nfl network"];

export function classifyChannel(channel?: string): WatchOn {
  const name = channel?.trim().toLowerCase();
  if (!name) return "unknown";
  if (CABLE_EXACT.includes(name)) return "cable";
  if (STREAMING.some((s) => name.includes(s))) return "streaming";
  // Anything else ending in "+" is a streaming tier of a cable brand.
  if (name.endsWith("+")) return "streaming";
  return "cable";
}

// Short label telling staff which box to use. Mirrors the house
// instructions in Help: cable goes through Input 2, streaming through the
// Apple TV.
export function watchLabel(channel?: string): string | null {
  switch (classifyChannel(channel)) {
    case "streaming":
      return "Apple TV";
    case "cable":
      return "Cable box";
    default:
      return null;
  }
}
