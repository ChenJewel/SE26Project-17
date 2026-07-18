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
import { useCallback, useEffect, useMemo, useState } from "react";
import BottomNav, { type PageId } from "./components/BottomNav";
import ContentDetailOverlay from "./components/ContentDetailOverlay";
import { PetCompanion } from "./components/pet/PetCompanion";
import SearchOverlay from "./components/SearchOverlay";
import Home from "./pages/Home";
import AuthPage from "./pages/Auth";
import CreateCard from "./pages/CreateCard";
import Community from "./pages/Community";
import ProfileOnboarding from "./pages/ProfileOnboarding";
import { createDirectConversation, joinPublicGroup, type BackendConversation } from "./services/chatApi";
import { useAuthState } from "./hooks/useAuthState";
import { mapConversation, useChatConversations } from "./hooks/useChatConversations";
import { useCommunityState } from "./hooks/useCommunityState";
import { useExchangeRequests } from "./hooks/useExchangeRequests";
import { useGlobalDetail } from "./hooks/useGlobalDetail";
import { useMealCards } from "./hooks/useMealCards";
import { useNotifications } from "./hooks/useNotifications";
import { usePetCompanion } from "./hooks/usePetCompanion";
import { subscribeRealtimeEvents, subscribeRealtimeStatus, useRealtimeEvents, type RealtimeStatus } from "./hooks/useRealtimeEvents";
import { useCapacitorBackButton } from "./hooks/useCapacitorBackButton";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/Settings";
import type { MealCard } from "./types/meal";
import type { Conversation } from "./types/chat";
import type { UserSummary } from "./types/user";
import { scrollToTop } from "./lib/platform";
import { uniqueTrimmed } from "./lib/collections";

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("idle");
  const [directChatConversation, setDirectChatConversation] = useState<Conversation | null>(null);
  const [interfaceRefreshing, setInterfaceRefreshing] = useState(false);
  const [refreshFeedbackKey, setRefreshFeedbackKey] = useState(0);
  const { currentUser, isAuthenticated, authNotice, authSummary, login, register, logout, deleteAccount, updateProfile } = useAuthState();
  useRealtimeEvents(isAuthenticated, currentUser?.id);
  const { notifications, unreadCounts, markTypeRead, refreshNotifications } = useNotifications(isAuthenticated);
  const { conversations: chatConversations, refreshConversations } = useChatConversations(isAuthenticated, currentUser?.id);
  const { cards, tagOptions, publishedCardId, publishCard, updateCard, removeCard, replaceTagOptions, refreshCards } = useMealCards();
  const {
    posts,
    comments,
    interactions,
    setInteractions,
    publishPost,
    publishComment,
    editPost,
    deletePost,
    deleteComment,
    togglePostLike,
    togglePostFavorite,
    toggleCommentLike,
    toggleCommentFavorite,
    sharePost,
    refreshCommunity,
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
    refreshProfile,
    followUser,
    openUserDetail,
    openCardDetail,
    openPostDetail,
  } = useGlobalDetail(currentUser?.id);
  const petCompanion = usePetCompanion(isAuthenticated, profileTags, currentUser?.id, currentPage);
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
  const sharedTags = useMemo(
    () => uniqueTrimmed([...profileTags, ...tagOptions, ...detailCards.flatMap((card) => card.tags)]),
    [detailCards, profileTags, tagOptions]
  );
  const chatUnreadCount = useMemo(
    () => chatConversations.reduce((total, conversation) => total + Math.max(0, conversation.unread), 0),
    [chatConversations]
  );
  const needsProfileOnboarding = Boolean(isAuthenticated && currentUser && currentUser.profileCompleted === false);

  const syncTagOptions = (nextTags: string[]) => {
    replaceTagOptions(uniqueTrimmed([...sharedTags, ...nextTags]));
  };

  const syncSharedTags = (nextTags: string[], persist = true) => {
    const normalizedTags = uniqueTrimmed(nextTags);
    setProfileTags(normalizedTags);
    syncTagOptions(normalizedTags);
    if (persist) {
      updateProfile({ preferenceTags: normalizedTags }).catch((error) => {
        console.warn("Failed to save preference tags.", error);
      });
    }
  };

  useEffect(() => subscribeRealtimeStatus(setRealtimeStatus), []);

  useEffect(() => {
    if (!isAuthenticated || needsProfileOnboarding) return;
    refreshCards().catch((error) => {
      console.warn("Failed to refresh meal cards after auth state changed.", error);
    });
  }, [isAuthenticated, needsProfileOnboarding, currentUser?.id, refreshCards]);

  useEffect(() => {
    const applyReducedMotionPreference = () => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem("ueat-settings-v2") || "{}") as { reduceMotion?: boolean };
        document.documentElement.classList.toggle("reduce-motion", Boolean(parsed.reduceMotion));
      } catch {
        document.documentElement.classList.remove("reduce-motion");
      }
    };

    applyReducedMotionPreference();
    window.addEventListener("storage", applyReducedMotionPreference);
    return () => window.removeEventListener("storage", applyReducedMotionPreference);
  }, []);

  useEffect(() => {
    let activeSheet: HTMLElement | null = null;
    let activeShell: HTMLElement | null = null;
    let pointerId = 0;
    let startY = 0;
    let currentY = 0;
    let moved = false;
    const history: Array<{ y: number; time: number }> = [];

    const isInteractiveTarget = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(target.closest("button,input,textarea,select,a,label,video,audio,[contenteditable='true']"));

    const getLiveTranslateY = (element: HTMLElement) => {
      const transform = window.getComputedStyle(element).transform;
      if (!transform || transform === "none") return 0;
      const matrix = new DOMMatrixReadOnly(transform);
      return matrix.m42;
    };

    const findDismissButton = (sheet: HTMLElement) =>
      sheet.querySelector<HTMLButtonElement>("[data-sheet-dismiss], [aria-label*='关闭'], [aria-label*='取消']");

    const resetSheet = () => {
      if (!activeSheet || !activeShell) return;
      const sheet = activeSheet;
      activeShell.classList.remove("app-sheet-dragging");
      sheet.style.transition = "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)";
      sheet.style.transform = "";
      activeShell.style.setProperty("--sheet-drag-progress", "0");
      window.setTimeout(() => {
        sheet.style.transition = "";
        sheet.style.animation = "";
      }, 340);
      activeSheet = null;
      activeShell = null;
    };

    const closeSheet = () => {
      if (!activeSheet || !activeShell) return;
      const sheet = activeSheet;
      const shell = activeShell;
      shell.classList.remove("app-sheet-dragging");
      sheet.style.transition = "transform 220ms cubic-bezier(0.2, 0, 0.2, 1), opacity 180ms ease";
      sheet.style.transform = "translate3d(0, 110%, 0) scale(0.97)";
      sheet.style.opacity = "0.72";
      shell.style.setProperty("--sheet-drag-progress", "1");
      window.setTimeout(() => {
        findDismissButton(shell)?.click();
        sheet.style.transition = "";
        sheet.style.transform = "";
        sheet.style.opacity = "";
        sheet.style.animation = "";
        shell.style.setProperty("--sheet-drag-progress", "0");
      }, 180);
      activeSheet = null;
      activeShell = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) return;
      const sheet = (event.target as Element | null)?.closest(".app-bottom-sheet > section") as HTMLElement | null;
      const shell = sheet?.closest(".app-bottom-sheet") as HTMLElement | null;
      if (!sheet || !shell) return;

      const grabOffset = event.clientY - sheet.getBoundingClientRect().top;
      if (grabOffset > 82 && sheet.scrollTop > 2) return;

      pointerId = event.pointerId;
      activeSheet = sheet;
      activeShell = shell;
      startY = event.clientY - getLiveTranslateY(sheet);
      currentY = 0;
      moved = false;
      history.length = 0;
      history.push({ y: event.clientY, time: performance.now() });
      sheet.setPointerCapture(event.pointerId);
      shell.classList.add("app-sheet-dragging");
      sheet.style.animation = "none";
      sheet.style.transition = "none";
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!activeSheet || event.pointerId !== pointerId) return;
      const rawDelta = event.clientY - startY;
      const delta = rawDelta < 0 ? rawDelta * 0.18 : rawDelta;
      currentY = Math.max(-18, delta);
      moved ||= Math.abs(currentY) > 4;

      const progress = Math.min(1, Math.max(0, currentY / 220));
      activeShell?.style.setProperty("--sheet-drag-progress", progress.toFixed(3));
      activeSheet.style.transform = `translate3d(0, ${currentY}px, 0) scale(${1 - progress * 0.018})`;

      const now = performance.now();
      history.push({ y: event.clientY, time: now });
      while (history.length > 5) history.shift();
      event.preventDefault();
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (!activeSheet || event.pointerId !== pointerId) return;
      const first = history[0];
      const last = history[history.length - 1];
      const elapsed = Math.max(1, (last?.time ?? 0) - (first?.time ?? 0));
      const velocity = (((last?.y ?? event.clientY) - (first?.y ?? event.clientY)) / elapsed) * 1000;
      const projectedY = currentY + velocity * 0.18;

      if (moved && (projectedY > 138 || velocity > 950)) {
        closeSheet();
        return;
      }

      resetSheet();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerEnd);
    document.addEventListener("pointercancel", onPointerEnd);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerEnd);
      document.removeEventListener("pointercancel", onPointerEnd);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeRealtimeEvents((event) => {
      if (event.type !== "user.profile.updated") return;
      refreshConversations().catch((error) => console.warn("Failed to refresh conversations after profile update.", error));
      refreshProfile().catch((error) => console.warn("Failed to refresh profile after profile update.", error));
    });
  }, [isAuthenticated, refreshConversations, refreshProfile]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const match = window.location.pathname.match(/^\/chat\/groups\/([^/]+)$/);
    const groupId = match?.[1];
    if (!groupId) return;

    joinPublicGroup(groupId)
      .then((conversation) => {
        setDirectChatConversation(mapConversation(conversation, currentUser?.id));
        navigate("chat");
        window.history.replaceState(null, "", "/");
        return refreshConversations();
      })
      .catch((error) => console.warn("Failed to open shared group link.", error));
  }, [currentUser?.id, isAuthenticated, refreshConversations]);

  useCapacitorBackButton(() => {
    if (searchOpen) {
      setSearchOpen(false);
      return true;
    }

    if (detailTarget) {
      setDetailTarget(null);
      return true;
    }

    if (currentPage === "settings") {
      navigate("profile");
      return true;
    }

    if (currentPage === "create") {
      navigate("home");
      return true;
    }

    if (currentPage !== "home") {
      if (currentPage === "chat") resetChatListNavigation();
      navigate("home");
      return true;
    }

    return false;
  }, isAuthenticated);

  const navigate = (page: PageId) => {
    setCurrentPage(page);
    scrollToTop();
  };

  const handlePublish = async (card: MealCard) => {
    syncTagOptions(card.tags);
    await publishCard(card);
    petCompanion.grant("meal_card");
    navigate("home");
  };

  const handleInvite = async (card: MealCard) => {
    await createInvite(card);
    await refreshConversations();
    petCompanion.grant("exchange");
    navigate("chat");
  };

  const handlePublishPost = async (...args: Parameters<typeof publishPost>) => {
    const post = await publishPost(...args);
    petCompanion.grant("post");
    refreshProfile().catch((error) => console.warn("Failed to refresh profile after post.", error));
    return post;
  };

  const handlePublishComment = async (...args: Parameters<typeof publishComment>) => {
    const comment = await publishComment(...args);
    petCompanion.grant("comment");
    refreshProfile().catch((error) => console.warn("Failed to refresh profile after comment.", error));
    return comment;
  };

  const handleTogglePostLike = (postId: string) => {
    const alreadyLiked = interactions.likedPostIds.includes(postId);
    togglePostLike(postId);
    if (!alreadyLiked) petCompanion.grant("like");
  };

  const handleTogglePostFavorite = (postId: string) => {
    const alreadyFavorited = interactions.favoritePostIds.includes(postId);
    togglePostFavorite(postId);
    if (!alreadyFavorited) petCompanion.grant("favorite");
  };

  const handleToggleCommentLike = (commentId: string) => {
    const alreadyLiked = interactions.likedCommentIds.includes(commentId);
    toggleCommentLike(commentId);
    if (!alreadyLiked) petCompanion.grant("like");
  };

  const handleToggleCommentFavorite = (commentId: string) => {
    const alreadyFavorited = interactions.favoriteCommentIds.includes(commentId);
    toggleCommentFavorite(commentId);
    if (!alreadyFavorited) petCompanion.grant("favorite");
  };

  const handleSharePost = (postId: string) => {
    sharePost(postId);
    petCompanion.grant("share");
  };

  const handleCompleteOnboarding = async (input: {
    nickname: string;
    avatarText: string;
    avatarUrl?: string;
    preferenceTags: string[];
    profileCompleted: boolean;
  }) => {
    const user = await updateProfile(input);
    syncSharedTags(input.preferenceTags, false);
    await refreshCards();
    refreshProfile().catch((error) => console.warn("Failed to refresh profile after onboarding.", error));
    return user;
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

  const handleChatDetailEntered = useCallback((conversation: Conversation) => {
    petCompanion.patchPet({
      visible: true,
      collapsed: false,
      wallMode: "none",
      edgeHidden: "none",
      currentAction: "sayShy",
      lastLine: conversation.group
        ? "进群聊详情啦。拿不准怎么接话时，输入框右侧的键盘会帮你想几个自然话题。"
        : "不知道怎么回复的话，输入框右侧的键盘可以帮你推荐三四句高情商接法。",
    });
  }, [petCompanion.patchPet]);

  const refreshInterface = async () => {
    if (interfaceRefreshing) return;

    setInterfaceRefreshing(true);
    setRefreshFeedbackKey((value) => value + 1);
    scrollToTop();

    try {
      await Promise.allSettled([
        refreshCards(),
        refreshCommunity(),
        refreshConversations(),
        refreshNotifications(),
        refreshProfile(),
      ]);
    } finally {
      window.setTimeout(() => setInterfaceRefreshing(false), 420);
    }
  };

  const navigateFromBottomNav = (page: PageId) => {
    if (page === "home") {
      navigate("home");
      void refreshInterface();
      return;
    }

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
            onOpenUser={openUserDetail}
            onOpenCard={openCardDetail}
            onRefresh={refreshCards}
            currentUserId={currentUser?.id}
          />
        );
      case "community":
        return (
          <Community
            posts={posts}
            comments={comments}
            interactions={interactions}
            onInteractionsChange={setInteractions}
            onPublishPost={handlePublishPost}
            onEditPost={editPost}
            onDeletePost={deletePost}
            onDeleteComment={deleteComment}
            onPublishComment={handlePublishComment}
            onTogglePostLike={handleTogglePostLike}
            onTogglePostFavorite={handleTogglePostFavorite}
            onToggleCommentLike={handleToggleCommentLike}
            onToggleCommentFavorite={handleToggleCommentFavorite}
            onSharePost={handleSharePost}
            onSearch={() => setSearchOpen(true)}
            onOpenUser={openUserDetail}
            followedUsers={followedUsers}
            currentUserId={currentUser?.id}
            currentUserRole={currentUser?.role}
          />
        );
      case "create":
        return (
          <CreateCard
            currentUser={currentUser}
            tagOptions={sharedTags}
            selectedTags={profileTags}
            onTagOptionsChange={syncTagOptions}
            onSelectedTagsChange={() => undefined}
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
            onChatDetailEntered={handleChatDetailEntered}
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
            profileTags={profileTags}
            onProfileTagsChange={syncSharedTags}
            onAvatarTextChange={(avatarText) => updateProfile({ avatarText })}
            onProfileUpdate={updateProfile}
            onTagOptionsChange={syncTagOptions}
            followedUsers={followedUsers}
            profileSnapshot={profileSnapshot}
            pet={petCompanion.pet}
            petXpToNext={petCompanion.xpToNext}
            onShowPet={() => petCompanion.patchPet({ visible: true, collapsed: false, currentAction: "happy", lastLine: "我回来啦，继续陪你约饭。" })}
            onHidePet={() => petCompanion.patchPet({ visible: false })}
            onFeedPet={() => petCompanion.grant("manual_feed")}
            onSettings={() => navigate("settings")}
            onLogout={logout}
            onOpenUser={openUserDetail}
            onOpenCard={openCardDetail}
            onOpenPost={openPostDetail}
            onUpdatePost={editPost}
            onDeletePost={deletePost}
            onUpdateCard={updateCard}
            onDeleteCard={removeCard}
          />
        );
      case "settings":
        return <SettingsPage currentUser={currentUser} authSummary={authSummary} onBack={() => navigate("profile")} onLogout={logout} onDeleteAccount={deleteAccount} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--page-bg)] text-[var(--text-main)]">
      {!isAuthenticated ? (
        <AuthPage notice={authNotice} onLogin={login} onRegister={register} />
      ) : needsProfileOnboarding && currentUser ? (
        <ProfileOnboarding currentUser={currentUser} tagOptions={sharedTags} onComplete={handleCompleteOnboarding} />
      ) : (
        renderPage()
      )}
      {isAuthenticated && !needsProfileOnboarding && currentPage !== "settings" ? (
        <BottomNav
          currentPage={currentPage}
          onNavigate={navigateFromBottomNav}
          chatUnreadCount={chatUnreadCount}
          homeRefreshing={interfaceRefreshing}
        />
      ) : null}
      {isAuthenticated && !needsProfileOnboarding ? <SearchOverlay
        open={searchOpen}
        cards={detailCards}
        posts={posts}
        onClose={() => setSearchOpen(false)}
        onOpenUser={openUserDetail}
        onOpenCard={openCardDetail}
        onOpenPost={openPostDetail}
      /> : null}
      {isAuthenticated && !needsProfileOnboarding ? <ContentDetailOverlay
        target={detailTarget}
        cards={detailCards}
        posts={posts}
        comments={comments}
        interactions={interactions}
        followedUserNames={followedUsers.map((user) => user.name)}
        onPublishComment={handlePublishComment}
        onTogglePostLike={handleTogglePostLike}
        onTogglePostFavorite={handleTogglePostFavorite}
        onToggleCommentLike={handleToggleCommentLike}
        onToggleCommentFavorite={handleToggleCommentFavorite}
        onSharePost={handleSharePost}
        onDeleteComment={deleteComment}
        onFollowUser={followUser}
        onMessageUser={handleMessageUser}
        onOpenUser={openUserDetail}
        onInviteCard={handleInvite}
        onOpenCard={openCardDetail}
        onOpenPost={openPostDetail}
        currentUserId={currentUser?.id}
        currentUserRole={currentUser?.role}
        onClose={() => setDetailTarget(null)}
      /> : null}
      {isAuthenticated && !needsProfileOnboarding ? <RealtimeStatusPill status={realtimeStatus} /> : null}
      {isAuthenticated && !needsProfileOnboarding && interfaceRefreshing ? <InterfaceRefreshFeedback key={refreshFeedbackKey} /> : null}
      {isAuthenticated && !needsProfileOnboarding ? (
        <PetCompanion
          pet={petCompanion.pet}
          xpToNext={petCompanion.xpToNext}
          onPatch={petCompanion.patchPet}
          onMove={petCompanion.movePet}
          onFeed={() => petCompanion.grant("manual_feed")}
          onDrink={() => petCompanion.grant("manual_drink")}
          onAnimationDone={petCompanion.finishAction}
        />
      ) : null}
    </div>
  );
}

function InterfaceRefreshFeedback() {
  return (
    <div className="app-refresh-feedback pointer-events-none fixed inset-0 z-[130]">
      <div className="app-refresh-indicator">
        <span className="app-refresh-spinner" />
      </div>
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
    avatarUrl: conversation.avatarUrl,
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
