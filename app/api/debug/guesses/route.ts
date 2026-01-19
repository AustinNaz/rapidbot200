import { NextResponse } from "next/server";
import { getAllGuesses, getRound } from "@/lib/guess-state";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const broadcasterId =
    url.searchParams.get("broadcasterId") || process.env.BROADCASTER_ID;

  if (!broadcasterId) {
    return NextResponse.json(
      { ok: false, error: "Missing broadcasterId" },
      { status: 400 }
    );
  }

  const round = await getRound(broadcasterId);
  const guesses = await getAllGuesses(broadcasterId);

  // Sanitize: don’t leak target in debug unless you want it
  const safeRound = round
    ? { ...round, target: undefined }
    : null;

  return NextResponse.json({
    ok: true,
    round: safeRound,
    guessCount: Object.keys(guesses).length,
    guesses,
  });
}
