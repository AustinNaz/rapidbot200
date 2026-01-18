import { NextResponse } from "next/server";
import { getBotAccessToken } from "@/lib/twitch-token";

export const runtime = "nodejs";

export async function GET() {
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const token = await getBotAccessToken();

  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  return NextResponse.json({ ok: res.ok, data }, { status: res.ok ? 200 : 500 });
}
