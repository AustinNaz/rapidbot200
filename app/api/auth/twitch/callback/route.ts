import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  token_type: "bearer";
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });
  if (!code) return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });

  const clientId = process.env.TWITCH_CLIENT_ID!;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET!;
  const redirectUri = process.env.TWITCH_REDIRECT_URI!;

  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const data = (await tokenRes.json()) as TokenResponse | any;
  if (!tokenRes.ok) return NextResponse.json({ ok: false, data }, { status: 500 });

  // Store in Upstash (you can namespace by "bot")
  await redis.set("twitch:bot:token", {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  });

  return NextResponse.json({ ok: true, scope: data.scope });
}
