import { redis } from "./redis";

type StoredAppToken = {
  access_token: string;
  expires_at: number;
};

export async function getAppAccessToken(): Promise<string> {
  const existing = await redis.get<StoredAppToken>("twitch:app:token");
  if (existing && Date.now() < existing.expires_at - 60_000) {
    return existing.access_token;
  }

  const clientId = process.env.TWITCH_CLIENT_ID!;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET!;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to get app token: ${JSON.stringify(data)}`);

  const stored: StoredAppToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  await redis.set("twitch:app:token", stored);
  return stored.access_token;
}
