/**
 * 消息页与聊天详情页。
 *
 * 会话列表只展示真实入口：系统消息，以及从“想一起吃”即时创建的约饭会话。
 * 旧的静态 mock 会话不再进入正式列表，避免新注册用户看到别人历史数据。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatDetail } from "@/components/chat/ChatDetail";
import { ConversationList } from "@/components/chat/ConversationList";
import type { CommunityPost } from "@/data/community";
import { useCapacitorBackButton } from "@/hooks/useCapacitorBackButton";
import type { Conversation } from "@/types/chat";
import type { MealExchangeRequest } from "@/types/exchange";
import type { AppNotification, NotificationType } from "@/types/notification";

export default function Chat({
  activeName,
  exchangeRequests,
  autoOpenRequestId,
  listResetSignal,
  conversations,
  directConversation,
  posts,
  notifications,
  unreadCounts,
  currentUserId,
  onChatChanged,
  onDirectConversationConsumed,
  onOpenUser,
  onOpenPost,
  onOpenCard,
  onExchangeRespond,
  onMarkNotificationsRead,
}: {
  activeName: string;
  exchangeRequests: MealExchangeRequest[];
  autoOpenRequestId: string | null;
  listResetSignal: number;
  conversations: Conversation[];
  directConversation: Conversation | null;
  posts: CommunityPost[];
  notifications: AppNotification[];
  unreadCounts: Record<NotificationType, number>;
  currentUserId?: string;
  onChatChanged: () => void;
  onDirectConversationConsumed: () => void;
  onOpenUser: (name: string, userId?: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
  onOpenCard: (cardId: string) => void;
  onExchangeRespond: (requestId: string, status: "rejected" | "accepted") => void;
  onMarkNotificationsRead: (types: NotificationType[]) => void;
}) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const autoOpenedRequestId = useRef<string | null>(null);

  useCapacitorBackButton(() => {
    if (!activeConversation) return false;
    setActiveConversation(null);
    return true;
  }, Boolean(activeConversation));

  const sortedConversations = useMemo(() => {
    const latestMessage = notifications.find((notification) => notification.type === "message");
    const systemConversation: Conversation = {
      id: "system",
      name: "系统消息",
      avatar: "U",
      preview: latestMessage?.text ?? "暂无系统消息",
      time: latestMessage ? "刚刚" : "系统",
      unread: 0,
      verified: true,
    };

    return [systemConversation, ...conversations];
  }, [conversations, notifications]);

  useEffect(() => {
    if (!autoOpenRequestId || autoOpenedRequestId.current === autoOpenRequestId) return;

    autoOpenedRequestId.current = autoOpenRequestId;
    const request = exchangeRequests.find((item) => item.id === autoOpenRequestId);
    setActiveConversation({
      id: request?.conversationId ?? `invite-${autoOpenRequestId}`,
      name: request?.targetName || activeName || "新的约饭会话",
      avatar: (activeName || "约").slice(0, 1),
      preview: "约饭邀请已发送。",
      time: "刚刚",
      unread: 0,
      verified: true,
    });
  }, [activeName, autoOpenRequestId, exchangeRequests]);

  useEffect(() => {
    setActiveConversation(null);
  }, [listResetSignal]);

  useEffect(() => {
    if (!directConversation) return;
    setActiveConversation(directConversation);
    onDirectConversationConsumed();
  }, [directConversation, onDirectConversationConsumed]);

  useEffect(() => {
    if (!activeConversation) return;
    const latest = conversations.find((conversation) => conversation.id === activeConversation.id);
    if (latest) {
      setActiveConversation(latest);
    }
  }, [activeConversation?.id, conversations]);

  const openConversation = (conversation: Conversation) => {
    if (conversation.id === "system") {
      onMarkNotificationsRead(["message"]);
    }
    setActiveConversation(conversation);
  };

  if (activeConversation) {
    return (
      <ChatDetail
        conversation={activeConversation}
        exchangeRequests={exchangeRequests.filter((request) => request.targetName === activeConversation.name)}
        onExchangeRespond={onExchangeRespond}
        onOpenUser={onOpenUser}
        onOpenPost={onOpenPost}
        onOpenCard={onOpenCard}
        currentUserId={currentUserId}
        onChatChanged={onChatChanged}
        onBack={() => setActiveConversation(null)}
      />
    );
  }

  return (
    <ConversationList
      conversations={sortedConversations}
      posts={posts}
      notifications={notifications}
      unreadCounts={unreadCounts}
      onOpenConversation={openConversation}
      onOpenUser={onOpenUser}
      onOpenPost={onOpenPost}
      onMarkNotificationsRead={onMarkNotificationsRead}
      currentUserId={currentUserId}
      onChatChanged={onChatChanged}
    />
  );
}
