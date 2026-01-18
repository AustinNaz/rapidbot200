import { NextResponse } from "next/server";
import { createChatMessageSubscription } from "@/lib/twitch";

export const runtime = "nodejs";

export async function POST() {
  const result = await createChatMessageSubscription();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
