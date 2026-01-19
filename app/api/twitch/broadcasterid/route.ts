import { NextResponse } from "next/server";
import { getBotAccessToken } from "@/lib/twitch-token";

export const runtime = "nodejs";

export async function GET() {
  const token = await getBotAccessToken();
  const channelLogin = process.env.BROADCASTER_LOGIN!; // e.g. "yourchannelname"

  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channelLogin)}`,
    {
      headers: {
        "Client-Id": process.env.TWITCH_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();

  if (!res.ok || !data.data?.length) {
    return NextResponse.json({ ok: false, data }, { status: 500 });
  }

  const user = data.data[0];
  return NextResponse.json({
    ok: true,
    broadcaster: {
      id: user.id,
      login: user.login,
      display_name: user.display_name,
    },
  });
}
