/**
 * 消息页与聊天详情页。
 *
 * 页面级逻辑只保留：
 * - 默认显示 ConversationList
 * - 点击会话进入 ChatDetail
 * - 接收 App 传来的 autoOpenRequestId 自动打开一次聊天详情
 * - 接收 listResetSignal 后回到消息列表
 *
 * 真正的会话列表、聊天详情和交换卡片 UI 已拆到 components/chat。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatDetail } from "@/components/chat/ChatDetail";
import { ConversationList } from "@/components/chat/ConversationList";
import { conversations, findInitialConversation, type Conversation } from "@/data/chat";
import type { CommunityComment, CommunityPost } from "@/data/community";
import type { MealExchangeRequest } from "@/types/exchange";
import type { UserSummary } from "@/types/user";

export default function Chat({
  activeName,
  exchangeRequests,
  autoOpenRequestId,
  listResetSignal,
  posts,
  comments,
  followedUsers,
  onOpenUser,
  onOpenPost,
  onOpenCard,
  onExchangeRespond,
}: {
  activeName: string;
  exchangeRequests: MealExchangeRequest[];
  autoOpenRequestId: string | null;
  listResetSignal: number;
  posts: CommunityPost[];
  comments: CommunityComment[];
  followedUsers: UserSummary[];
  onOpenUser: (name: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
  onOpenCard: (cardId: string) => void;
  onExchangeRespond: (requestId: string, status: "rejected" | "accepted") => void;
}) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  // App controls whether this page opens as a list or a deep-linked conversation.
  // This avoids using static mock data as navigation truth after the app grows.
  const autoOpenedRequestId = useRef<string | null>(null);
  const sortedConversations = useMemo(() => {
    const hinted = findInitialConversation(activeName);
    return [...conversations].sort((a, b) => {
      if (hinted && a.id === hinted.id) return -1;
      if (hinted && b.id === hinted.id) return 1;
      return b.unread - a.unread;
    });
  }, [activeName]);

  useEffect(() => {
    const hinted = findInitialConversation(activeName);
    if (hinted && autoOpenRequestId && autoOpenedRequestId.current !== autoOpenRequestId) {
      autoOpenedRequestId.current = autoOpenRequestId;
      setActiveConversation(hinted);
    }
  }, [activeName, autoOpenRequestId]);

  useEffect(() => {
    setActiveConversation(null);
  }, [listResetSignal]);

  if (activeConversation) {
    return (
      <ChatDetail
        conversation={activeConversation}
        exchangeRequests={exchangeRequests.filter((request) => request.targetName === activeConversation.name)}
        onExchangeRespond={onExchangeRespond}
        onOpenUser={onOpenUser}
        onOpenCard={onOpenCard}
        onBack={() => setActiveConversation(null)}
      />
    );
  }

  return (
    <ConversationList
      conversations={sortedConversations}
      posts={posts}
      comments={comments}
      followedUsers={followedUsers}
      onOpenConversation={setActiveConversation}
      onOpenUser={onOpenUser}
      onOpenPost={onOpenPost}
    />
  );
}
