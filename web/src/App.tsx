/**
 * 应用状态与页面路由入口。
 *
 * 这里负责页面编排和跨页面跳转。
 *
 * 共享数据已经下沉到 hooks：
 * - useMealCards: 约饭卡和标签池
 * - useCommunityState: 帖子、评论、互动
 * - useGlobalDetail: 搜索、详情浮层、关注、偏好
 * - useExchangeRequests: 想一起吃和聊天 deep-link 意图
 * - useAuthState: 登录、注册、当前用户
 *
 * 当前项目没有接后端，所以发布卡片、发评论、点赞收藏等行为都先存在 React state 中；
 * 后续接接口时，优先替换 hooks 内部实现，再把这里的页面切换换成真实路由。
 */
import { useEffect, useMemo, useState } from "react";
import BottomNav, { type PageId } from "./components/BottomNav";
import ContentDetailOverlay from "./components/ContentDetailOverlay";
import SearchOverlay from "./components/SearchOverlay";
import Home from "./pages/Home";
import AuthPage from "./pages/Auth";
import CreateCard from "./pages/CreateCard";
import Community from "./pages/Community";
import { createDirectConversation, type BackendConversation } from "./services/chatApi";
import { useAuthState } from "./hooks/useAuthState";
import { useChatConversations } from "./hooks/useChatConversations";
import { useCommunityState } from "./hooks/useCommunityState";
import { useExchangeRequests } from "./hooks/useExchangeRequests";
import { useGlobalDetail } from "./hooks/useGlobalDetail";
import { useMealCards } from "./hooks/useMealCards";
import { useNotifications } from "./hooks/useNotifications";
import { subscribeRealtimeStatus, useRealtimeEvents, type RealtimeStatus } from "./hooks/useRealtimeEvents";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/Settings";
import type { MealCard } from "./types/meal";
import type { Conversation } from "./types/chat";
import type { UserSummary } from "./types/user";
import { scrollToTop } from "./lib/platform";
import { uniqueTrimmed } from "./lib/collections";

const defaultSharedTags = ["晚饭", "二食堂", "喜欢安静"];

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("idle");
  const [directChatConversation, setDirectChatConversation] = useState<Conversation | null>(null);
  const { currentUser, isAuthenticated, authNotice, authSummary, login, register, logout, updateProfile } = useAuthState();
  useRealtimeEvents(isAuthenticated, currentUser?.id);
  const { notifications, unreadCounts, markTypeRead } = useNotifications(isAuthenticated);
  const { conversations: chatConversations, refreshConversations } = useChatConversations(isAuthenticated, currentUser?.id);
  const { cards, tagOptions, publishedCardId, publishCard, updateCard, removeCard, replaceTagOptions } = useMealCards();
  const {
    posts,
    comments,
    interactions,
    setInteractions,
    publishPost,
    publishComment,
    editPost,
    deletePost,
    togglePostLike,
    togglePostFavorite,
    toggleCommentLike,
    toggleCommentFavorite,
  } = useCommunityState(currentUser?.id);
  const {
    searchOpen,
    setSearchOpen,
    detailTarget,
    setDetailTarget,
    profileTags,
    setProfileTags,
    followedUsers,
    profileSnapshot,
    followUser,
    openUserDetail,
    openCardDetail,
    openPostDetail,
  } = useGlobalDetail(currentUser?.id);
  const {
    activeChatName,
    exchangeRequests,
    autoOpenRequestId,
    chatListResetSignal,
    createInvite,
    respondExchange,
    resetChatListNavigation,
  } = useExchangeRequests(cards, publishedCardId);
  const detailCards = useMemo(() => mergeMealCards(cards, profileSnapshot?.cards ?? []), [cards, profileSnapshot?.cards]);
  const homeCards = useMemo(
    () => cards.filter((card) =>
      (!currentUser?.id || card.userId !== currentUser.id) &&
      (card.status ?? "active") === "active" &&
      !isMealCardExpired(card)
    ),
    [cards, currentUser?.id]
  );
  const syncedTagOptions = useMemo(
    () => uniqueTrimmed([...tagOptions, ...profileTags, ...detailCards.flatMap((card) => card.tags)]),
    [detailCards, profileTags, tagOptions]
  );
  const sharedTags = useMemo(
    () => uniqueTrimmed(profileTags.length ? profileTags : defaultSharedTags),
    [profileTags]
  );

  const syncTagOptions = (nextTags: string[]) => {
    replaceTagOptions(uniqueTrimmed([...syncedTagOptions, ...nextTags]));
  };

  const syncSharedTags = (nextTags: string[]) => {
    const normalizedTags = uniqueTrimmed(nextTags);
    setProfileTags(normalizedTags);
    syncTagOptions(normalizedTags);
  };

  useEffect(() => subscribeRealtimeStatus(setRealtimeStatus), []);

  const navigate = (page: PageId) => {
    setCurrentPage(page);
    scrollToTop();
  };

  const handlePublish = async (card: MealCard) => {
    syncSharedTags(card.tags);
    await publishCard(card);
    navigate("home");
  };

  const handleInvite = (card: MealCard) => {
    createInvite(card).then(refreshConversations);
    navigate("chat");
  };

  const handleMessageUser = async (user: UserSummary) => {
    if (!user.userId) return;

    try {
      const conversation = await createDirectConversation(user.userId, user.name);
      setDirectChatConversation(toConversation(conversation, user.name, user.avatar, currentUser?.id));
      setDetailTarget(null);
      setSearchOpen(false);
      await refreshConversations();
      navigate("chat");
    } catch (error) {
      console.warn("Failed to open direct message.", error);
    }
  };

  const navigateFromBottomNav = (page: PageId) => {
    if (page === "chat") {
      resetChatListNavigation();
    }
    navigate(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return (
          <Home
            cards={homeCards}
            tagOptions={sharedTags}
            publishedCardId={publishedCardId}
            onCreate={() => navigate("create")}
            onInvite={handleInvite}
            onSearch={() => setSearchOpen(true)}
          />
        );
      case "community":
        return (
          <Community
            posts={posts}
            comments={comments}
            interactions={interactions}
            onInteractionsChange={setInteractions}
            onPublishPost={publishPost}
            onEditPost={editPost}
            onDeletePost={deletePost}
            onPublishComment={publishComment}
            onTogglePostLike={togglePostLike}
            onTogglePostFavorite={togglePostFavorite}
            onToggleCommentLike={toggleCommentLike}
            onToggleCommentFavorite={toggleCommentFavorite}
            onSearch={() => setSearchOpen(true)}
            onOpenUser={openUserDetail}
            currentUserId={currentUser?.id}
            currentUserRole={currentUser?.role}
          />
        );
      case "create":
        return (
          <CreateCard
            currentUser={currentUser}
            tagOptions={sharedTags}
            selectedTags={sharedTags}
            onTagOptionsChange={syncTagOptions}
            onSelectedTagsChange={syncSharedTags}
            onPublish={handlePublish}
            onCancel={() => navigate("home")}
          />
        );
      case "chat":
        return (
          <Chat
            activeName={activeChatName}
            exchangeRequests={exchangeRequests}
            autoOpenRequestId={autoOpenRequestId}
            listResetSignal={chatListResetSignal}
            conversations={chatConversations}
            directConversation={directChatConversation}
            posts={posts}
            notifications={notifications}
            unreadCounts={unreadCounts}
            currentUserId={currentUser?.id}
            onChatChanged={refreshConversations}
            onDirectConversationConsumed={() => setDirectChatConversation(null)}
            onOpenUser={openUserDetail}
            onOpenPost={openPostDetail}
            onOpenCard={openCardDetail}
            onExchangeRespond={respondExchange}
            onMarkNotificationsRead={markTypeRead}
          />
        );
      case "profile":
        return (
          <Profile
            currentUser={currentUser}
            authSummary={authSummary}
            cards={detailCards}
            posts={posts}
            comments={comments}
            interactions={interactions}
            tagOptions={sharedTags}
            profileTags={sharedTags}
            onProfileTagsChange={syncSharedTags}
            onAvatarTextChange={(avatarText) => updateProfile({ avatarText })}
            onProfileUpdate={updateProfile}
            onTagOptionsChange={syncTagOptions}
            followedUsers={followedUsers}
            profileSnapshot={profileSnapshot}
            onSettings={() => navigate("settings")}
            onLogout={logout}
            onOpenUser={openUserDetail}
            onOpenCard={openCardDetail}
            onOpenPost={openPostDetail}
            onUpdateCard={updateCard}
            onDeleteCard={removeCard}
          />
        );
      case "settings":
        return <SettingsPage currentUser={currentUser} authSummary={authSummary} onBack={() => navigate("profile")} onLogout={logout} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--page-bg)] text-[var(--text-main)]">
      {!isAuthenticated ? (
        <AuthPage notice={authNotice} onLogin={login} onRegister={register} />
      ) : (
        renderPage()
      )}
      {isAuthenticated && currentPage !== "settings" ? (
        <BottomNav
          currentPage={currentPage}
          onNavigate={navigateFromBottomNav}
        />
      ) : null}
      {isAuthenticated ? <SearchOverlay
        open={searchOpen}
        cards={detailCards}
        posts={posts}
        onClose={() => setSearchOpen(false)}
        onOpenUser={openUserDetail}
        onOpenCard={openCardDetail}
        onOpenPost={openPostDetail}
      /> : null}
      {isAuthenticated ? <ContentDetailOverlay
        target={detailTarget}
        cards={detailCards}
        posts={posts}
        comments={comments}
        followedUserNames={followedUsers.map((user) => user.name)}
        onFollowUser={followUser}
        onMessageUser={handleMessageUser}
        onOpenCard={openCardDetail}
        onOpenPost={openPostDetail}
        onClose={() => setDetailTarget(null)}
      /> : null}
      {isAuthenticated ? <RealtimeStatusPill status={realtimeStatus} /> : null}
    </div>
  );
}

function isMealCardExpired(card: MealCard) {
  const value = card.time.trim();
  const explicitDate = value.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!explicitDate) return false;

  const year = Number(explicitDate[1]);
  const month = Number(explicitDate[2]);
  const day = Number(explicitDate[3]);
  const cardDate = new Date(year, month - 1, day + 1).getTime();
  return Number.isFinite(cardDate) && cardDate < Date.now();
}

function toConversation(
  conversation: BackendConversation,
  fallbackName: string,
  fallbackAvatar: string,
  currentUserId?: string
): Conversation {
  const name = conversation.title || fallbackName || "私信";
  return {
    id: conversation.id,
    otherUserId: conversation.otherUserId,
    name,
    avatar: fallbackAvatar || name.slice(0, 1),
    preview: conversation.preview || "还没有消息",
    time: "刚刚",
    unread: currentUserId ? conversation.unreadByUserId[currentUserId] ?? 0 : 0,
    online: Boolean(conversation.online),
    verified: true,
  };
}

function mergeMealCards(primaryCards: MealCard[], extraCards: MealCard[]) {
  const cardsById = new Map<string, MealCard>();
  for (const card of [...primaryCards, ...extraCards]) {
    cardsById.set(card.id, card);
  }
  return [...cardsById.values()];
}

function RealtimeStatusPill({ status }: { status: RealtimeStatus }) {
  if (status === "idle" || status === "connected") return null;

  const labelMap: Record<RealtimeStatus, string> = {
    idle: "",
    connecting: "实时连接中",
    connected: "",
    reconnecting: "实时重连中",
    disconnected: "实时已断开",
  };

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[120] -translate-x-1/2 px-3">
      <div className="rounded-lg bg-[rgba(23,35,31,0.9)] px-3 py-2 text-xs font-black text-white shadow-[0_10px_26px_rgba(18,30,25,0.22)] ring-1 ring-white/10">
        {labelMap[status]}
      </div>
    </div>
  );
}
