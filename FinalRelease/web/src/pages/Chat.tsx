/**
 * 消息页与聊天详情页。
 *
 * 会话列表只展示真实入口：系统消息，以及从“想一起吃”即时创建的约饭会话。
 * 旧的静态 mock 会话不再进入正式列表，避免新注册用户看到别人历史数据。
 */
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  onChatDetailEntered,
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
  onChatDetailEntered?: (conversation: Conversation) => void;
}) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const autoOpenedRequestId = useRef<string | null>(null);
  const safeExchangeRequests = Array.isArray(exchangeRequests) ? exchangeRequests : [];
  const safeConversations = Array.isArray(conversations) ? conversations : [];
  const safePosts = Array.isArray(posts) ? posts : [];
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const safeUnreadCounts: Record<NotificationType, number> = {
    like: unreadCounts?.like ?? 0,
    favorite: unreadCounts?.favorite ?? 0,
    follow: unreadCounts?.follow ?? 0,
    comment: unreadCounts?.comment ?? 0,
    message: unreadCounts?.message ?? 0,
    report: unreadCounts?.report ?? 0,
  };

  useCapacitorBackButton(() => {
    if (!activeConversation) return false;
    setActiveConversation(null);
    return true;
  }, Boolean(activeConversation));

  const sortedConversations = useMemo(() => {
    const latestMessage = safeNotifications.find((notification) => notification.type === "message");
    const systemConversation: Conversation = {
      id: "system",
      name: "系统消息",
      avatar: "U",
      preview: latestMessage?.text ?? "暂无系统消息",
      time: latestMessage ? "刚刚" : "系统",
      unread: 0,
      verified: true,
    };

    return [systemConversation, ...safeConversations];
  }, [safeConversations, safeNotifications]);

  useEffect(() => {
    if (!autoOpenRequestId || autoOpenedRequestId.current === autoOpenRequestId) return;

    autoOpenedRequestId.current = autoOpenRequestId;
    const request = safeExchangeRequests.find((item) => item.id === autoOpenRequestId);
    setActiveConversation({
      id: request?.conversationId ?? `invite-${autoOpenRequestId}`,
      name: request?.targetName || activeName || "新的约饭会话",
      avatar: (activeName || "约").slice(0, 1),
      preview: "约饭邀请已发送。",
      time: "刚刚",
      unread: 0,
      verified: true,
    });
  }, [activeName, autoOpenRequestId, safeExchangeRequests]);

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
    const latest = safeConversations.find((conversation) => conversation.id === activeConversation.id);
    if (latest) {
      setActiveConversation(latest);
    }
  }, [activeConversation?.id, safeConversations]);

  useEffect(() => {
    if (!activeConversation) return;
    onChatDetailEntered?.(activeConversation);
  }, [activeConversation?.id, onChatDetailEntered]);

  const openConversation = (conversation: Conversation) => {
    if (conversation.id === "system") {
      onMarkNotificationsRead(["message"]);
    }
    setActiveConversation(conversation);
  };

  if (activeConversation) {
    return (
      <ChatDetailErrorBoundary
        conversationId={activeConversation.id}
        onBack={() => setActiveConversation(null)}
      >
        <ChatDetail
          conversation={activeConversation}
          exchangeRequests={safeExchangeRequests.filter((request) => request.targetName === activeConversation.name)}
          onExchangeRespond={onExchangeRespond}
          onOpenUser={onOpenUser}
          onOpenPost={onOpenPost}
          onOpenCard={onOpenCard}
          currentUserId={currentUserId}
          onChatChanged={onChatChanged}
          onConversationLeft={() => {
            setActiveConversation(null);
            onChatChanged();
          }}
          onBack={() => setActiveConversation(null)}
        />
      </ChatDetailErrorBoundary>
    );
  }

  return (
    <ConversationList
      conversations={sortedConversations}
      posts={safePosts}
      notifications={safeNotifications}
      unreadCounts={safeUnreadCounts}
      onOpenConversation={openConversation}
      onOpenUser={onOpenUser}
      onOpenPost={onOpenPost}
      onMarkNotificationsRead={onMarkNotificationsRead}
      currentUserId={currentUserId}
      onChatChanged={onChatChanged}
    />
  );
}

class ChatDetailErrorBoundary extends Component<
  { children: ReactNode; conversationId: string; onBack: () => void },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(previousProps: { conversationId: string }) {
    if (previousProps.conversationId !== this.props.conversationId && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error) {
    console.error("Chat detail render failed.", error);
    try {
      window.localStorage.setItem("ueat-last-chat-error", JSON.stringify({
        conversationId: this.props.conversationId,
        message: error.message,
        stack: error.stack,
        createdAt: new Date().toISOString(),
      }));
    } catch {
      // Diagnostics only.
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-shell flex min-h-[100dvh] items-center justify-center px-5 text-[var(--text-main)]">
        <section className="w-full max-w-sm rounded-lg bg-white/86 p-5 text-center shadow-[0_18px_44px_rgba(23,43,37,0.12)] ring-1 ring-[var(--line-soft)]">
          <h1 className="display-cn text-[22px]">聊天暂时打不开</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-muted)]">这条会话加载时遇到异常，先返回消息列表。</p>
          <button onClick={this.props.onBack} className="mt-4 h-11 rounded-full bg-[var(--pine)] px-6 text-sm font-black text-white shadow-[0_10px_24px_rgba(63,111,96,0.22)]">
            返回消息
          </button>
        </section>
      </main>
    );
  }
}
