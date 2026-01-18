import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET() {
  const t = await redis.get("twitch:bot:token");
  return NextResponse.json({
    hasToken: Boolean(t),
    // don't print tokens in logs; show only metadata
    keys: t ? Object.keys(t as object) : [],
  });
}
