import Redis from "ioredis";
import type { RealtimeEvent } from "@/shared/types";

const redisUrl = process.env.REDIS_URL;
let publisher: Redis | null = null;

export const REALTIME_CHANNEL = "fluidchat:events";

function client() {
  if (!redisUrl) return null;

  publisher ??= new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2
  });

  return publisher;
}

export type RealtimeRoom =
  | `conversation:${string}`
  | `workspace:${string}`
  | `user:${string}`;

export async function publish(
  room: RealtimeRoom,
  event: RealtimeEvent
) {
  const payload = JSON.stringify({ room, event });
  const redis = client();

  if (redis) {
    try {
      if (redis.status === "wait" || redis.status === "end") {
        await redis.connect();
      }

      await redis.publish(REALTIME_CHANNEL, payload);
      return;
    } catch (error) {
      console.warn("realtime publish over redis failed", error);
    }
  }

  const localPort = process.env.PORT ?? process.env.REALTIME_PORT;

  const url =
    process.env.REALTIME_INTERNAL_URL ??
    (localPort
      ? `http://127.0.0.1:${localPort}`
      : "http://localhost:3001");

  try {
    const response = await fetch(`${url}/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.REALTIME_TOKEN
          ? { "x-fluidchat-token": process.env.REALTIME_TOKEN }
          : {})
      },
      body: payload,
      signal: AbortSignal.timeout(1500)
    });

    if (!response.ok) {
      console.warn(
        `realtime publish failed with status ${response.status}`
      );
    }
  } catch {
    // Realtime is optional; clients can recover by refetching.
  }
}

export function toConversation(
  conversationId: string,
  event: RealtimeEvent
) {
  return publish(`conversation:${conversationId}`, event);
}

export function toWorkspace(
  workspaceId: string,
  event: RealtimeEvent
) {
  return publish(`workspace:${workspaceId}`, event);
}

export function toUser(userId: string, event: RealtimeEvent) {
  return publish(`user:${userId}`, event);
}

export function toUsers(userIds: string[], event: RealtimeEvent) {
  return Promise.all(
    Array.from(new Set(userIds)).map((userId) =>
      toUser(userId, event)
    )
  );
}
