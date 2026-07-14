import { useEffect } from "react";
import { runtimeConfig } from "@/config/runtime";
import { getStoredAuthToken } from "@/services/authApi";

export const realtimeEventName = "ueat:realtime";
export const realtimeStatusEventName = "ueat:realtime-status";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export interface RealtimeEvent<T = unknown> {
  type: string;
  data: T;
  createdAt: string;
}

export function useRealtimeEvents(isAuthenticated: boolean, userId?: string) {
  useEffect(() => {
    if (!isAuthenticated || !userId || typeof window === "undefined" || !("WebSocket" in window)) {
      dispatchRealtimeStatus("idle");
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let closedByEffect = false;

    const connect = () => {
      const token = getStoredAuthToken();
      if (!token) return;

      dispatchRealtimeStatus(socket ? "reconnecting" : "connecting");
      const url = new URL("/ws", runtimeConfig.wsUrl);
      url.searchParams.set("token", token);
      socket = new WebSocket(url.toString());

      socket.addEventListener("open", () => {
        dispatchRealtimeStatus("connected");
      });

      socket.addEventListener("message", (event) => {
        try {
          const detail = JSON.parse(event.data) as RealtimeEvent;
          window.dispatchEvent(new CustomEvent(realtimeEventName, { detail }));
        } catch (error) {
          console.warn("Failed to parse realtime event.", error);
        }
      });

      socket.addEventListener("close", () => {
        socket = null;
        if (!closedByEffect) {
          dispatchRealtimeStatus("reconnecting");
          reconnectTimer = window.setTimeout(connect, 2500);
        } else {
          dispatchRealtimeStatus("disconnected");
        }
      });
    };

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
      dispatchRealtimeStatus("disconnected");
    };
  }, [isAuthenticated, userId]);
}

function dispatchRealtimeStatus(status: RealtimeStatus) {
  window.dispatchEvent(new CustomEvent(realtimeStatusEventName, { detail: status }));
}

export function subscribeRealtimeEvents(handler: (event: RealtimeEvent) => void) {
  const listener = (event: Event) => {
    handler((event as CustomEvent<RealtimeEvent>).detail);
  };

  window.addEventListener(realtimeEventName, listener);
  return () => window.removeEventListener(realtimeEventName, listener);
}

export function subscribeRealtimeStatus(handler: (status: RealtimeStatus) => void) {
  const listener = (event: Event) => {
    handler((event as CustomEvent<RealtimeStatus>).detail);
  };

  window.addEventListener(realtimeStatusEventName, listener);
  return () => window.removeEventListener(realtimeStatusEventName, listener);
}
