import { useCallback, useEffect, useState } from "react";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { fetchChatConversations, type BackendConversation } from "@/services/chatApi";
import type { Conversation } from "@/types/chat";

export function useChatConversations(isAuthenticated: boolean, currentUserId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setConversations([]);
      return;
    }

    try {
      const items = await fetchChatConversations();
      setConversations(items.map((item) => mapConversation(item, currentUserId)));
    } catch (error) {
      console.warn("Failed to load chat conversations.", error);
      setConversations([]);
    }
  }, [currentUserId, isAuthenticated]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (event.type === "presence.updated" && isPresenceEvent(event.data)) {
        const presence = event.data;
        setConversations((current) =>
          current.map((conversation) =>
            conversation.otherUserId === presence.userId
              ? { ...conversation, online: presence.online }
              : conversation
          )
        );
        return;
      }

      if (event.type.startsWith("chat.")) {
        loadConversations();
      }
    });

    return unsubscribe;
  }, [isAuthenticated, loadConversations]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = window.setInterval(loadConversations, 30000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, loadConversations]);

  return {
    conversations,
    refreshConversations: loadConversations,
  };
}

export function mapConversation(item: BackendConversation, currentUserId?: string): Conversation {
  return {
    id: item.id,
    otherUserId: item.otherUserId,
    name: item.title || (item.group ? "群聊" : "约饭会话"),
    avatar: item.avatarText || (item.title || "群").slice(0, 2),
    preview: item.preview || "还没有消息",
    time: formatConversationTime(item.updatedAt),
    unread: currentUserId ? item.unreadByUserId[currentUserId] ?? 0 : 0,
    online: Boolean(item.online),
    verified: true,
    group: Boolean(item.group),
    memberCount: item.memberCount,
    description: item.description,
    category: item.category,
    location: item.location,
    joinQuestion: item.joinQuestion,
    isPublic: item.isPublic,
    ownerUserId: item.ownerUserId,
    joined: item.joined,
  };
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isPresenceEvent(data: unknown): data is { userId: string; online: boolean } {
  return Boolean(
    data &&
      typeof data === "object" &&
      typeof (data as { userId?: unknown }).userId === "string" &&
      typeof (data as { online?: unknown }).online === "boolean"
  );
}
