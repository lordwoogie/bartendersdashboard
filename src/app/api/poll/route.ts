import { NextResponse } from "next/server";
import { readData, mutateData } from "@/lib/storage";
import {
  POLL,
  countVotes,
  normalizeInitials,
  type PollData,
  type PollVote,
} from "@/lib/poll";

const DOC = "poll.json";

// Votes are read straight after every write, so this must never be cached.
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

function isAdmin(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  return request.headers.get("x-admin-password") === password;
}

// GET /api/poll[?initials=XX]
// Public: the poll, the tallies, and whether it's closed. Passing initials
// also reports what that person already picked, so a returning voter sees
// their own choice instead of an empty ballot. Individual votes are only
// returned to an admin.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await readData<PollData>(DOC);
  const votes = data.votes || [];
  const { counts, total } = countVotes(votes);

  const initials = normalizeInitials(searchParams.get("initials") || "");
  const mine = initials
    ? votes.find((v) => v.initials === initials)?.optionId || null
    : null;

  return NextResponse.json(
    {
      poll: POLL,
      counts,
      total,
      closed: data.closed === true,
      yourVote: mine,
      ...(isAdmin(request) ? { votes } : {}),
    },
    { headers: NO_STORE }
  );
}

// POST /api/poll { initials, optionId } — cast a vote. Open to staff (no
// login), same as the rest of the tablet surface.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const initials = normalizeInitials(
    typeof body.initials === "string" ? body.initials : ""
  );
  const optionId = typeof body.optionId === "string" ? body.optionId : "";

  if (!initials) {
    return NextResponse.json({ error: "Add your initials to vote" }, { status: 400 });
  }
  if (!POLL.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: "Pick an option" }, { status: 400 });
  }

  const vote: PollVote = {
    initials,
    optionId,
    votedAt: new Date().toISOString(),
  };

  // Captured inside the mutation; reset each attempt because mutateData may
  // retry under contention.
  let already: string | null = null;
  const next = await mutateData<PollData>(DOC, (current) => {
    already = null;
    const votes = current.votes || [];
    if (current.closed === true) {
      already = "__closed__";
      return current;
    }
    const existing = votes.find((v) => v.initials === initials);
    if (existing) {
      // One ballot per set of initials — that's the whole point of asking for
      // them. Report the existing choice rather than silently overwriting.
      already = existing.optionId;
      return current;
    }
    return { ...current, votes: [...votes, vote] };
  });

  if (already === "__closed__") {
    return NextResponse.json(
      { error: "This poll is closed." },
      { status: 409 }
    );
  }
  if (already) {
    const { counts, total } = countVotes(next.votes || []);
    return NextResponse.json(
      {
        error: `${initials} already voted.`,
        yourVote: already,
        counts,
        total,
      },
      { status: 409 }
    );
  }

  const { counts, total } = countVotes(next.votes || []);
  return NextResponse.json({ success: true, yourVote: optionId, counts, total });
}

// PATCH /api/poll { closed: boolean } — admin opens or closes voting.
export async function PATCH(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const closed = body?.closed === true;
  const next = await mutateData<PollData>(DOC, (current) => ({
    ...current,
    votes: current.votes || [],
    closed,
  }));
  return NextResponse.json({ success: true, closed: next.closed === true });
}

// DELETE /api/poll?initials=XX — admin removes one vote (mis-entered
// initials). Omit initials to clear the whole ballot box.
export async function DELETE(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const initials = normalizeInitials(searchParams.get("initials") || "");

  const next = await mutateData<PollData>(DOC, (current) => {
    const votes = current.votes || [];
    return {
      ...current,
      votes: initials ? votes.filter((v) => v.initials !== initials) : [],
    };
  });

  const { counts, total } = countVotes(next.votes || []);
  return NextResponse.json({ success: true, counts, total });
}
