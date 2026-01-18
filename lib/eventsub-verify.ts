import crypto from "crypto";

/**
 * Twitch signature: sha256=HMAC_SHA256(secret, messageId + timestamp + rawBody)
 */
export function verifyEventSubSignature(args: {
  secret: string;
  messageId: string | null;
  timestamp: string | null;
  theirSignature: string | null;
  rawBody: Uint8Array;
}) {
  const { secret, messageId, timestamp, theirSignature, rawBody } = args;

  if (!messageId || !timestamp || !theirSignature) return false;

  const msg = Buffer.concat([
    Buffer.from(messageId, "utf8"),
    Buffer.from(timestamp, "utf8"),
    Buffer.from(rawBody),
  ]);

  const hmac = crypto.createHmac("sha256", secret).update(msg).digest("hex");
  const ours = `sha256=${hmac}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(ours), Buffer.from(theirSignature));
  } catch {
    return false;
  }
}
