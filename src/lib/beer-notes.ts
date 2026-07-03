// Persistent notes for the beers we serve. Two sources:
//   - "manual": an admin typed it in /admin. Always wins.
//   - "ai":     Claude generated it lazily the first time a customer viewed
//               the beer card. Cached forever until an admin overrides.
//
// Notes are keyed by a normalized beer name so they survive the beer's
// changing Untappd IDs (a new keg often gets a fresh id).

export interface BeerNote {
  key: string;
  tastingNotes: string;
  source: "manual" | "ai";
  updatedAt: string;
}

// Match a beer name to its stored note tolerating whitespace, curly quotes,
// and case. Same policy on write and read so lookups don't miss.
export function beerNoteKey(name: string, brewery?: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[’‘'`]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  const n = norm(name);
  const b = brewery ? norm(brewery) : "";
  return b ? `${b}|${n}` : n;
}
