import { getBotAccessToken } from "./twitch-token";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function sendChatMessage(message: string) {
  const clientId = must("TWITCH_CLIENT_ID");
  const broadcasterId = must("BROADCASTER_ID");
  const senderId = must("BOT_USER_ID");

  const token = await getBotAccessToken();

  const res = await fetch("https://api.twitch.tv/helix/chat/messages", {
    method: "POST",
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      sender_id: senderId,
      message,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) console.error("sendChatMessage failed:", res.status, data);
  return { ok: res.ok, status: res.status, data };
}

export async function createChatMessageSubscription() {
  const clientId = must("TWITCH_CLIENT_ID");
  const broadcasterId = must("BROADCASTER_ID");
  const botUserId = must("BOT_USER_ID");
  const callback = must("EVENTSUB_CALLBACK");
  const secret = must("EVENTSUB_SECRET");

  const token = await getBotAccessToken();

  const body = {
    type: "channel.chat.message",
    version: "1",
    condition: {
      broadcaster_user_id: broadcasterId,
      user_id: botUserId,
    },
    transport: {
      method: "webhook",
      callback,
      secret,
    },
  };

  const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) console.error("createChatMessageSubscription failed:", res.status, data);
  return { ok: res.ok, status: res.status, data };
}
