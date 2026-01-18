import { redis } from "./redis";

export type Round = {
  open: boolean;
  min: number;
  max: number;
  target: number;
  startedAt: number;
  endsAt?: number; // optional if you want timed rounds
};

const ROUND_KEY = (broadcasterId: string) => `guess:round:${broadcasterId}`;
const GUESSES_KEY = (broadcasterId: string) => `guess:guesses:${broadcasterId}`;
// store guesses as a hash: field=userId, value=JSON string

export async function getRound(broadcasterId: string): Promise<Round | null> {
  return (await redis.get<Round>(ROUND_KEY(broadcasterId))) ?? null;
}

export async function setRound(broadcasterId: string, round: Round) {
  await redis.set(ROUND_KEY(broadcasterId), round);
  // clear guesses when starting a new round
  await redis.del(GUESSES_KEY(broadcasterId));
}

export async function endRound(broadcasterId: string) {
  const round = await getRound(broadcasterId);
  if (!round) return null;
  await redis.set(ROUND_KEY(broadcasterId), { ...round, open: false });
  return { ...round, open: false } satisfies Round;
}

export type GuessEntry = { name: string; guess: number; ts: number };

export async function setGuess(broadcasterId: string, userId: string, entry: GuessEntry) {
  await redis.hset(GUESSES_KEY(broadcasterId), { [userId]: JSON.stringify(entry) });
}

export async function getAllGuesses(broadcasterId: string): Promise<Record<string, GuessEntry>> {
  const raw = (await redis.hgetall<Record<string, string>>(GUESSES_KEY(broadcasterId))) ?? {};
  const out: Record<string, GuessEntry> = {};
  for (const [userId, json] of Object.entries(raw)) {
    try {
      out[userId] = JSON.parse(json) as GuessEntry;
    } catch {
      // ignore bad entry
    }
  }
  return out;
}

export function pickWinner(target: number, guesses: Record<string, GuessEntry>) {
  let winner: { userId: string; entry: GuessEntry; diff: number } | null = null;

  for (const [userId, entry] of Object.entries(guesses)) {
    const diff = Math.abs(entry.guess - target);

    if (!winner) {
      winner = { userId, entry, diff };
      continue;
    }
    if (diff < winner.diff) {
      winner = { userId, entry, diff };
      continue;
    }
    if (diff === winner.diff && entry.ts < winner.entry.ts) {
      winner = { userId, entry, diff };
    }
  }

  return winner;
}
