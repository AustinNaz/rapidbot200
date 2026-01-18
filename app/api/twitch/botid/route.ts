import { NextResponse } from "next/server";
import { getBotAccessToken } from "@/lib/twitch-token";

export const runtime = "nodejs";

export async function GET() {
  const token = await getBotAccessToken();

  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ ok: false, data }, { status: 500 });
  }

  const user = data.data[0];
  return NextResponse.json({
    ok: true,
    bot: {
      id: user.id,
      login: user.login,
      display_name: user.display_name,
    },
  });
}
