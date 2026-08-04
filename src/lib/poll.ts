// Staff poll shown on the dashboard. The question and options live here in
// code; only the votes are stored (poll.json). Voters type their initials so
// one person can't stack the ballot.

export interface PollVote {
  initials: string; // normalized (see normalizeInitials)
  optionId: string;
  votedAt: string; // ISO 8601
}

export interface PollData {
  closed?: boolean;
  votes: PollVote[];
}

export interface PollOption {
  id: string;
  title: string;
  summary: string;
  details: string[];
}

export interface Poll {
  id: string;
  question: string;
  intro?: string;
  options: PollOption[];
  // Rules that hold no matter which option wins, so they don't read as a
  // reason to prefer one over the other.
  bothWays?: string[];
}

export const POLL: Poll = {
  id: "comp-policy-2026-08",
  question: "How should our comp policy work?",
  intro:
    "We're changing how comps are handled. Two options — read both, then vote with your initials.",
  options: [
    {
      id: "friends-price",
      title: "Option 1 — Friends price per beer",
      summary: "Every beer gets its own set friends price.",
      details: [
        "Each beer has a fixed friends price instead of a discount.",
        "Example: an IPA is $2, a Cowboy Cold is $1.",
        "The friends price is listed in the menu for each beer, so there's nothing to calculate.",
      ],
    },
    {
      id: "percent-off",
      title: "Option 2 — Set percentage off the tab",
      summary: "A flat discount on the whole tab instead of per-beer pricing.",
      details: [
        "A set percentage comes off the tab rather than each beer having its own price.",
        "Example: Ty gets 75% off; everyone else gets 50% off.",
        "The percentage is applied at the register, so menu prices don't change.",
      ],
    },
  ],
  bothWays: [
    "Nobody gets 100% off without manager approval.",
    "Employees and their spouse are always 100%.",
  ],
};

// Initials are the ballot key, so "ty", "TY " and "T.Y." must all collide.
// Letters and digits only, uppercased, capped at 4 characters.
export function normalizeInitials(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4);
}

export function countVotes(
  votes: PollVote[]
): { counts: Record<string, number>; total: number } {
  const counts: Record<string, number> = {};
  for (const o of POLL.options) counts[o.id] = 0;
  for (const v of votes) {
    if (v.optionId in counts) counts[v.optionId]++;
  }
  return { counts, total: votes.length };
}
