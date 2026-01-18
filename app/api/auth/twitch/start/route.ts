import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const clientId = process.env.TWITCH_CLIENT_ID!;
  console.log({ clientId })
  const redirectUri = process.env.TWITCH_REDIRECT_URI!; // set this per env
  const scopes = [
    "user:read:chat",
    "user:write:chat",
    "user:bot",
    // You may later add more (e.g. moderation, etc.)
  ];

  const state = crypto.randomUUID(); // optionally store/validate in redis for CSRF
  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
