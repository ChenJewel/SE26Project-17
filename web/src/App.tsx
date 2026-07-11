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
 *
 * 当前项目没有接后端，所以发布卡片、发评论、点赞收藏等行为都先存在 React state 中；
 * 后续接接口时，优先替换 hooks 内部实现，再把这里的页面切换换成真实路由。
 */
import { useState } from "react";
import BottomNav, { type PageId } from "./components/BottomNav";
import ContentDetailOverlay from "./components/ContentDetailOverlay";
import SearchOverlay from "./components/SearchOverlay";
import Home from "./pages/Home";
import CreateCard from "./pages/CreateCard";
import Community from "./pages/Community";
import { useCommunityState } from "./hooks/useCommunityState";
import { useExchangeRequests } from "./hooks/useExchangeRequests";
import { useGlobalDetail } from "./hooks/useGlobalDetail";
import { useMealCards } from "./hooks/useMealCards";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/Settings";
import type { MealCard } from "./types/meal";

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const { cards, tagOptions, publishedCardId, publishCard, replaceTagOptions } = useMealCards();
  const { posts, comments, interactions, setPosts, setComments, setInteractions } = useCommunityState();
  const {
    searchOpen,
    setSearchOpen,
    detailTarget,
    setDetailTarget,
    profileTags,
    setProfileTags,
    followedUsers,
    followUser,
    openUserDetail,
    openCardDetail,
    openPostDetail,
  } = useGlobalDetail();
  const {
    activeChatName,
    exchangeRequests,
    autoOpenRequestId,
    chatListResetSignal,
    createInvite,
    respondExchange,
    resetChatListNavigation,
  } = useExchangeRequests(cards, publishedCardId);

  const navigate = (page: PageId) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePublish = (card: MealCard) => {
    publishCard(card);
    navigate("home");
  };

  const handleInvite = (card: MealCard) => {
    createInvite(card);
    navigate("chat");
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
            cards={cards}
            tagOptions={tagOptions}
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
            onPostsChange={setPosts}
            onCommentsChange={setComments}
            onInteractionsChange={setInteractions}
            onSearch={() => setSearchOpen(true)}
            onOpenUser={openUserDetail}
          />
        );
      case "create":
        return <CreateCard tagOptions={tagOptions} onPublish={handlePublish} onCancel={() => navigate("home")} />;
      case "chat":
        return (
          <Chat
            activeName={activeChatName}
            exchangeRequests={exchangeRequests}
            autoOpenRequestId={autoOpenRequestId}
            listResetSignal={chatListResetSignal}
            posts={posts}
            comments={comments}
            followedUsers={followedUsers}
            onOpenUser={openUserDetail}
            onOpenPost={openPostDetail}
            onOpenCard={openCardDetail}
            onExchangeRespond={respondExchange}
          />
        );
      case "profile":
        return (
          <Profile
            cards={cards}
            posts={posts}
            comments={comments}
            interactions={interactions}
            tagOptions={tagOptions}
            profileTags={profileTags}
            onProfileTagsChange={setProfileTags}
            onTagOptionsChange={replaceTagOptions}
            followedUsers={followedUsers}
            onSettings={() => navigate("settings")}
            onOpenUser={openUserDetail}
            onOpenCard={openCardDetail}
            onOpenPost={openPostDetail}
          />
        );
      case "settings":
        return <SettingsPage onBack={() => navigate("profile")} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-main)]">
      {renderPage()}
      {currentPage !== "settings" ? (
        <BottomNav
          currentPage={currentPage}
          onNavigate={navigateFromBottomNav}
        />
      ) : null}
      <SearchOverlay
        open={searchOpen}
        cards={cards}
        posts={posts}
        onClose={() => setSearchOpen(false)}
        onOpenUser={openUserDetail}
        onOpenCard={openCardDetail}
        onOpenPost={openPostDetail}
      />
      <ContentDetailOverlay
        target={detailTarget}
        cards={cards}
        posts={posts}
        comments={comments}
        followedUserNames={followedUsers.map((user) => user.name)}
        onFollowUser={followUser}
        onOpenCard={openCardDetail}
        onOpenPost={openPostDetail}
        onClose={() => setDetailTarget(null)}
      />
    </div>
  );
}
