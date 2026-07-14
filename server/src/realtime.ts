import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { postgresStore } from "./data/postgres.js";

export interface RealtimeEvent<T = unknown> {
  type: string;
  data: T;
  createdAt: string;
}

class RealtimeHub {
  private clientsByUserId = new Map<string, Set<WebSocket>>();
  private server?: WebSocketServer;

  attach(server: Server) {
    if (this.server) return;

    this.server = new WebSocketServer({ server, path: "/ws" });
    this.server.on("connection", async (socket, request) => {
      const token = this.readToken(request.url);
      const user = token ? await postgresStore.findUserById(token) : undefined;

      if (!user) {
        socket.close(1008, "Unauthenticated");
        return;
      }

      this.addClient(user.id, socket);
      this.send(socket, {
        type: "connected",
        data: { userId: user.id },
        createdAt: new Date().toISOString(),
      });
      this.broadcastAll({
        type: "presence.updated",
        data: { userId: user.id, online: true },
      });

      socket.on("message", (message) => {
        const text = message.toString();
        if (text === "ping") {
          this.send(socket, {
            type: "pong",
            data: {},
            createdAt: new Date().toISOString(),
          });
          return;
        }

        try {
          const event = JSON.parse(text) as { type?: string; data?: Record<string, unknown> };
          if (event.type === "chat.typing" && typeof event.data?.conversationId === "string") {
            this.broadcastConversationEvent(user.id, event.data.conversationId, Boolean(event.data.typing));
          }
        } catch {
          // Ignore malformed client-side realtime messages.
        }
      });

      socket.on("close", () => {
        this.removeClient(user.id, socket);
        this.broadcastAll({
          type: "presence.updated",
          data: { userId: user.id, online: this.isUserOnline(user.id) },
        });
      });
    });
  }

  broadcastToUsers<T>(userIds: string[], event: Omit<RealtimeEvent<T>, "createdAt"> & { createdAt?: string }) {
    const uniqueUserIds = Array.from(new Set(userIds));
    const payload: RealtimeEvent<T> = {
      ...event,
      createdAt: event.createdAt ?? new Date().toISOString(),
    };

    for (const userId of uniqueUserIds) {
      const clients = this.clientsByUserId.get(userId);
      if (!clients) continue;

      for (const client of clients) {
        this.send(client, payload);
      }
    }
  }

  broadcastAll<T>(event: Omit<RealtimeEvent<T>, "createdAt"> & { createdAt?: string }) {
    const payload: RealtimeEvent<T> = {
      ...event,
      createdAt: event.createdAt ?? new Date().toISOString(),
    };

    for (const clients of this.clientsByUserId.values()) {
      for (const client of clients) {
        this.send(client, payload);
      }
    }
  }

  isUserOnline(userId: string) {
    return Boolean(this.clientsByUserId.get(userId)?.size);
  }

  private readToken(requestUrl?: string) {
    if (!requestUrl) return undefined;
    try {
      const url = new URL(requestUrl, "http://localhost");
      return url.searchParams.get("token")?.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private addClient(userId: string, socket: WebSocket) {
    const clients = this.clientsByUserId.get(userId) ?? new Set<WebSocket>();
    clients.add(socket);
    this.clientsByUserId.set(userId, clients);
  }

  private removeClient(userId: string, socket: WebSocket) {
    const clients = this.clientsByUserId.get(userId);
    if (!clients) return;

    clients.delete(socket);
    if (!clients.size) {
      this.clientsByUserId.delete(userId);
    }
  }

  private async broadcastConversationEvent(userId: string, conversationId: string, typing: boolean) {
    const conversation = await postgresStore.findConversation(conversationId);
    if (!conversation?.memberUserIds.includes(userId)) return;

    this.broadcastToUsers(
      conversation.memberUserIds.filter((memberUserId) => memberUserId !== userId),
      {
        type: "chat.typing",
        data: { conversationId, userId, typing },
      }
    );
  }

  private send<T>(socket: WebSocket, event: RealtimeEvent<T>) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  }
}

export const realtimeHub = new RealtimeHub();
