import http from "node:http";
import { Server, type Socket } from "socket.io";
import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  conversationMembers,
  conversations,
  sessions,
  users,
  workspaceMembers,
  workspaces
} from "@/db/schema";
import { tokenHash } from "@/lib/security";
import { REALTIME_CHANNEL } from "@/lib/realtime";
import { sessionCookieName } from "@/lib/auth";
import type { RealtimeEvent } from "@/shared/types";
import { broadcastPresence } from "@/server/services/presence";

// This service runs separately from Next.js.
// Do not use process.env.PORT here: Blitz uses port 10000 for public traffic.
const port = Number(process.env.REALTIME_PORT ?? 3001);
const host = "0.0.0.0";
const redisUrl = process.env.REDIS_URL;

const connectionsByUser = new Map<string, number>();

function cookieValue(header: string | undefined, name: string) {
  if (!header) return null;

  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");

    if (rawKey === name) {
      try {
        return decodeURIComponent(rawValue.join("="));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function roomParts(room: string) {
  const segments = room.split(":");

  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    return null;
  }

  return { kind: segments[0], id: segments[1] };
}

async function userIdFromCookie(cookieHeader: string | undefined) {
  const token = cookieValue(cookieHeader, sessionCookieName);

  if (!token) return null;

  const [row] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash(token)),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  return row?.userId ?? null;
}

async function canJoinRoom(userId: string, room: string) {
  const parsed = roomParts(room);

  if (!parsed) return false;

  if (parsed.kind === "user") {
    return parsed.id === userId;
  }

  if (parsed.kind === "workspace") {
    const [member] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(
        workspaces,
        eq(workspaces.id, workspaceMembers.workspaceId)
      )
      .where(
        and(
          eq(workspaceMembers.workspaceId, parsed.id),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, "active"),
          isNull(workspaces.deletedAt)
        )
      )
      .limit(1);

    return !!member;
  }

  if (parsed.kind === "conversation") {
    const [member] = await db
      .select({ id: conversationMembers.id })
      .from(conversationMembers)
      .innerJoin(
        conversations,
        eq(conversations.id, conversationMembers.conversationId)
      )
      .innerJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, conversations.workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, "active")
        )
      )
      .where(
        and(
          eq(conversationMembers.conversationId, parsed.id),
          eq(conversationMembers.userId, userId),
          isNull(conversationMembers.leftAt)
        )
      )
      .limit(1);

    return !!member;
  }

  return false;
}

let io: Server;

const httpServer = http.createServer((request, response) => {
  const pathname = new URL(
    request.url ?? "/",
    "http://localhost"
  ).pathname;

  if (pathname === "/health") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(
      JSON.stringify({
        ok: true,
        service: "realtime",
        connectedUsers: connectionsByUser.size,
        redis: !!redisUrl
      })
    );
    return;
  }

  if (pathname === "/publish" && request.method === "POST") {
    const token = process.env.REALTIME_TOKEN;

    if (!token || request.headers["x-fluidchat-token"] !== token) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    request.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;

      if (totalBytes > 1_000_000) {
        response.writeHead(413);
        response.end("Payload too large");
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (response.writableEnded || response.destroyed) return;

      try {
        const parsed = JSON.parse(
          Buffer.concat(chunks).toString("utf8")
        ) as {
          room: string;
          event: RealtimeEvent;
        };

        if (
          !parsed ||
          typeof parsed.room !== "string" ||
          !parsed.event ||
          typeof parsed.event !== "object"
        ) {
          response.writeHead(400);
          response.end("Invalid payload");
          return;
        }

        io.to(parsed.room).emit("event", parsed.event);

        response.writeHead(202, {
          "content-type": "application/json; charset=utf-8"
        });
        response.end(JSON.stringify({ ok: true }));
      } catch {
        if (!response.headersSent) {
          response.writeHead(400);
          response.end("Invalid JSON");
        }
      }
    });

    request.on("error", () => {
      if (!response.headersSent && !response.destroyed) {
        response.writeHead(400);
        response.end();
      }
    });

    return;
  }

  response.writeHead(404, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify({ error: "Not found" }));
});

io = new Server(httpServer, {
  cors: {
    origin: process.env.APP_URL ?? "http://localhost:3000",
    credentials: true
  },
  transports: ["websocket", "polling"]
});

const pubClient = redisUrl ? new Redis(redisUrl) : null;
const subClient = pubClient?.duplicate() ?? null;

if (pubClient && subClient) {
  io.adapter(createAdapter(pubClient, subClient));
}

io.use(async (socket, nextSocket) => {
  try {
    const userId = await userIdFromCookie(
      socket.handshake.headers.cookie
    );

    if (!userId) {
      return nextSocket(new Error("Authentication required"));
    }

    socket.data.userId = userId;
    return nextSocket();
  } catch (error) {
    return nextSocket(
      error instanceof Error
        ? error
        : new Error("Authentication failed")
    );
  }
});

async function markOnline(userId: string) {
  const count = (connectionsByUser.get(userId) ?? 0) + 1;
  connectionsByUser.set(userId, count);

  if (count > 1) return;

  const [updated] = await db
    .update(users)
    .set({
      presence: "active",
      lastActiveAt: new Date()
    })
    .where(eq(users.id, userId))
    .returning();

  if (updated) await broadcastPresence(updated);
}

async function markOffline(userId: string) {
  const count = (connectionsByUser.get(userId) ?? 1) - 1;

  if (count > 0) {
    connectionsByUser.set(userId, count);
    return;
  }

  connectionsByUser.delete(userId);

  const [updated] = await db
    .update(users)
    .set({ presence: "offline" })
    .where(eq(users.id, userId))
    .returning();

  if (updated) await broadcastPresence(updated);
}

io.on("connection", (socket: Socket) => {
  const userId = socket.data.userId as string;

  void markOnline(userId).catch((error) => {
    console.error("presence online failed", error);
  });

  socket.on(
    "join",
    async (rooms: string[] = [], ack?: (joined: string[]) => void) => {
      try {
        const unique = Array.from(new Set(rooms)).slice(0, 500);

        const results = await Promise.all(
          unique.map(async (room) => ({
            room,
            allowed: await canJoinRoom(userId, room)
          }))
        );

        const joined = results
          .filter((entry) => entry.allowed)
          .map((entry) => entry.room);

        for (const room of joined) {
          socket.join(room);
        }

        ack?.(joined);
      } catch (error) {
        console.error("room join failed", error);
        ack?.([]);
      }
    }
  );

  socket.on("leave", (rooms: string[] = []) => {
    for (const room of rooms) {
      socket.leave(room);
    }
  });

  socket.on(
    "typing",
    async (payload: {
      conversationId?: string;
      parentMessageId?: string | null;
    }) => {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId) return;

        const room = `conversation:${conversationId}`;

        if (
          !socket.rooms.has(room) &&
          !(await canJoinRoom(userId, room))
        ) {
          return;
        }

        const event: RealtimeEvent = {
          type: "typing",
          conversationId,
          userId,
          parentMessageId: payload.parentMessageId ?? null
        };

        socket.to(room).emit("event", event);
      } catch (error) {
        console.error("typing event failed", error);
      }
    }
  );

  socket.on("heartbeat", async () => {
    try {
      await db
        .update(users)
        .set({ lastActiveAt: new Date() })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("heartbeat failed", error);
    }
  });

  socket.on("disconnect", () => {
    void markOffline(userId).catch((error) => {
      console.error("presence offline failed", error);
    });
  });
});

if (subClient) {
  subClient
    .subscribe(REALTIME_CHANNEL)
    .catch((error) => {
      console.error("Failed to subscribe to realtime events", error);
    });

  subClient.on("message", (_channel, raw) => {
    try {
      const parsed = JSON.parse(raw) as {
        room: string;
        event: RealtimeEvent;
      };

      io.to(parsed.room).emit("event", parsed.event);
    } catch (error) {
      console.error("Malformed realtime payload", error);
    }
  });
}

httpServer.listen(port, host, () => {
  console.log(
    `Fluid Chat realtime listening on ${host}:${port}; Redis: ${redisUrl ? "enabled" : "disabled"}`
  );
});
