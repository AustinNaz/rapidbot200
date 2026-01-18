 export async function sendChatMessage(message: string) {
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const token = process.env.TWITCH_ACCESS_TOKEN!;
  const broadcasterId = process.env.BROADCASTER_ID!;
  const senderId = process.env.BOT_USER_ID!;

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
  if (!res.ok) {
    console.error("sendChatMessage failed:", res.status, data);
  }
  return { ok: res.ok, status: res.status, data };
}

export async function createChatMessageSubscription() {
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const token = process.env.TWITCH_ACCESS_TOKEN!;
  const broadcasterId = process.env.BROADCASTER_ID!;
  const botUserId = process.env.BOT_USER_ID!;
  const callback = process.env.EVENTSUB_CALLBACK!;
  const secret = process.env.EVENTSUB_SECRET!;

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
  if (!res.ok) {
    console.error("createChatMessageSubscription failed:", res.status, data);
  }
  return { ok: res.ok, status: res.status, data };
}
