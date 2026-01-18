import { redis } from "./redis";

type StoredToken = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string[];
};

export async function getBotAccessToken(): Promise<string> {
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET!;

  const t = await redis.get<StoredToken>("twitch:bot:token");
  if (!t) throw new Error("Missing bot token. Visit /api/auth/twitch/start first.");

  // refresh ~60s early
  if (Date.now() < t.expires_at - 60_000) return t.access_token;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: t.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Refresh failed: ${JSON.stringify(data)}`);

  const updated: StoredToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? t.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? t.scope,
  };

  await redis.set("twitch:bot:token", updated);
  return updated.access_token;
}
