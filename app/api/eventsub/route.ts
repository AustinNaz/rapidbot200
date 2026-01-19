import { NextResponse } from "next/server";
import { verifyEventSubSignature } from "@/lib/eventsub-verify";
import { sendChatMessage } from "@/lib/twitch";
import {
  endRound,
  finalizeRound,
  getAllGuesses,
  getGuessCount,
  getRound,
  pickWinner,
  setGuess,
  setRound,
} from "@/lib/guess-state";

export const runtime = "nodejs"; // ensure Node crypto works on Vercel

type EventSubEnvelope = {
  subscription?: { type?: string };
  challenge?: string;
  event?: any;
};

function parseStartCommand(text: string) {
  const m = text.trim().match(/^!guessstart\s+(\d+)\s+(\d+)(?:\s+(\d+))?\s*$/i);
  if (!m) return null;
  const min = Number(m[1]);
  const max = Number(m[2]);
  const durationSec = m[3] ? Number(m[3]) : undefined;
  return { min, max, durationSec };
}

function parseEndCommand(text: string) {
  const m = text.trim().match(/^!guessend\s+(-?\d+)\s*$/i);
  if (!m) return null;
  return Number(m[1]);
}

function parseGuess(text: string) {
  const m = text.trim().match(/^!guess\s+(-?\d+)\s*$/i);
  if (!m) return null;
  return Number(m[1]);
}

function isModOrBroadcaster(event: any) {
  const badges: Array<{ set_id: string }> = event?.badges ?? [];
  const isMod = badges.some((b) => b.set_id === "moderator");
  const isBroadcaster =
    event?.chatter_user_id &&
    event?.broadcaster_user_id &&
    event.chatter_user_id === event.broadcaster_user_id;
  return isMod || isBroadcaster;
}

export async function POST(req: Request) {
  const secret = process.env.EVENTSUB_SECRET!;
  if (!secret) {
    return new NextResponse("Missing EVENTSUB_SECRET", { status: 500 });
  }

  // Raw body for signature verification
  const rawBuf = new Uint8Array(await req.arrayBuffer());

  const messageId = req.headers.get("Twitch-Eventsub-Message-Id");
  const timestamp = req.headers.get("Twitch-Eventsub-Message-Timestamp");
  const theirSig = req.headers.get("Twitch-Eventsub-Message-Signature");
  const msgType = req.headers.get("Twitch-Eventsub-Message-Type");

  const ok = verifyEventSubSignature({
    secret,
    messageId,
    timestamp,
    theirSignature: theirSig,
    rawBody: rawBuf,
  });

  if (!ok) return new NextResponse("Invalid signature", { status: 403 });

  const bodyText = new TextDecoder().decode(rawBuf);
  const payload = JSON.parse(bodyText) as EventSubEnvelope;

  if (msgType === "notification") {
    console.log("EventSub notification:", payload.subscription?.type);
  } else if (msgType === "revocation") {
    console.error("EventSub revoked:", payload);
  }

  if (msgType !== "keepalive") {
    console.log("EventSub:", msgType);
  }

  // 1) Verification handshake
  if (msgType === "webhook_callback_verification") {
    return new NextResponse(payload.challenge ?? "", { status: 200 });
  }

  // 2) Notifications
  if (msgType === "notification") {
    if (payload.subscription?.type !== "channel.chat.message") {
      return NextResponse.json({ ok: true });
    }

    const event = payload.event;
    const text: string = event?.message?.text ?? "";
    const broadcasterId: string =
      event?.broadcaster_user_id ?? process.env.BROADCASTER_ID!;
    const chatterId: string = event?.chatter_user_id;
    const chatterName: string = event?.chatter_user_name ?? "someone";

    // !guessstart <min> <max> [durationSeconds]
    const start = parseStartCommand(text);
    if (start && isModOrBroadcaster(event)) {
      const min = Math.min(start.min, start.max);
      const max = Math.max(start.min, start.max);

      const now = Date.now();
      const endsAt = start.durationSec
        ? now + start.durationSec * 1000
        : undefined;

      await setRound(broadcasterId, {
        open: true,
        min,
        max,
        target: null,
        startedAt: now,
        endsAt,
      });

      await sendChatMessage(
        `🎯 Guessing started! Pick ${min}-${max} with !guess <number>${start.durationSec ? ` (ends in ${start.durationSec}s)` : ""}. End with !guessend <target>`,
      );
      return NextResponse.json({ ok: true });
    }

    // !guessend <target>
    const endTarget = parseEndCommand(text);
    if (endTarget !== null && isModOrBroadcaster(event)) {
      const round = await getRound(broadcasterId);
      if (!round) {
        await sendChatMessage("No round running.");
        return NextResponse.json({ ok: true });
      }

      await finalizeRound(broadcasterId, endTarget);
      const guesses = await getAllGuesses(broadcasterId);

      const winner = pickWinner(endTarget, guesses);
      if (!winner) {
        await sendChatMessage(
          `Round ended! Target was ${endTarget}. No valid guesses 😅`,
        );
      } else {
        await sendChatMessage(
          `🏆 Target was ${endTarget}. Winner: ${winner.entry.name} (guessed ${winner.entry.guess}, off by ${winner.diff})`,
        );
      }
      return NextResponse.json({ ok: true });
    }
    if (/^!guessend\s*$/i.test(text) && isModOrBroadcaster(event)) {
      await sendChatMessage("Use !guessend <target> to end and reveal the target.");
      return NextResponse.json({ ok: true });
    }

    // Optional: auto-end if timed and time passed (end on next message)
    const round = await getRound(broadcasterId);
    if (round?.open && round.endsAt && Date.now() >= round.endsAt) {
      await endRound(broadcasterId);
      const guesses = await getAllGuesses(broadcasterId);
      if (typeof round.target !== "number") {
        await sendChatMessage(
          "⏱️ Time! Round closed. End with !guessend <target> to reveal the winner.",
        );
      } else {
        const winner = pickWinner(round.target, guesses);
        if (!winner) {
          await sendChatMessage(
            `⏱️ Time! Target was ${round.target}. No valid guesses 😅`,
          );
        } else {
          await sendChatMessage(
            `⏱️ Time! Target was ${round.target}. Winner: ${winner.entry.name} (guessed ${winner.entry.guess}, off by ${winner.diff})`,
          );
        }
      }
      return NextResponse.json({ ok: true });
    }

    // !currentround
    if (/^!currentround\s*$/i.test(text) && isModOrBroadcaster(event)) {
      const current = round ?? (await getRound(broadcasterId));
      if (!current) {
        await sendChatMessage("No round running.");
        return NextResponse.json({ ok: true });
      }

      const guessCount = getGuessCount(broadcasterId)
      const status = current.open ? "open" : "closed";
      const remainingMs =
        current.endsAt && current.open ? current.endsAt - Date.now() : null;
      const timePart =
        remainingMs !== null
          ? remainingMs > 0
            ? `, ${Math.ceil(remainingMs / 1000)}s left`
            : ", time ended"
          : "";

      await sendChatMessage(
        `🎯 Round ${status}: ${current.min}-${current.max}${timePart}. Number of guesses so far: ${guessCount}. Guess with !guess <number>`,
      );
      return NextResponse.json({ ok: true });
    }

    // !guess <n>
    const guess = parseGuess(text);
    if (guess !== null) {
      const current = round ?? (await getRound(broadcasterId));
      if (!current || !current.open) return NextResponse.json({ ok: true });

      if (guess < current.min || guess > current.max)
        return NextResponse.json({ ok: true });

      await setGuess(broadcasterId, chatterId, {
        name: chatterName,
        guess,
        ts: Date.now(),
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  }

  // 3) Revocations etc.
  return NextResponse.json({ ok: true });
}
