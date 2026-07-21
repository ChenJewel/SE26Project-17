import { useEffect, useState, type ReactNode } from "react";
import { Bookmark, Camera, ChevronLeft, Heart, Image as ImageIcon, MessageCircle, PenLine, Play, Sparkles, Star, Trash2, Utensils, X } from "lucide-react";
import { BackgroundPickerView } from "@/components/BackgroundPickerView";
import { PreferenceTagEditor } from "@/components/profile/PreferenceTagEditor";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { getProfileSectionTone, ProfileSection } from "@/components/profile/ProfileSection";
import { CommunityPostPreviewGrid } from "@/components/post/CommunityPostPreviewCard";
import { useBackgroundPreferences } from "@/hooks/useBackgroundPreferences";
import { useSheetDragToClose } from "@/hooks/useSheetDragToClose";
import type { CommunityComment, CommunityInteractionState, CommunityPost } from "@/data/community";
import type { fetchMyProfile } from "@/services/userApi";
import { uploadMedia } from "@/services/uploadApi";
import { resolveAvatarUrl, resolveMediaUrl } from "@/lib/mediaUrl";
import type { CurrentUser } from "@/types/auth";
import type { MealCard } from "@/types/meal";
import type { UserSummary } from "@/types/user";
import type { PetCompanionState } from "@/hooks/usePetCompanion";

interface ProfileProps {
  currentUser: CurrentUser | null;
  authSummary: string;
  cards: MealCard[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  interactions: CommunityInteractionState;
  tagOptions: string[];
  profileTags: string[];
  onProfileTagsChange: (tags: string[]) => void;
  onAvatarTextChange: (avatarText: string) => void;
  onProfileUpdate: (input: { nickname?: string; school?: string; bio?: string; avatarUrl?: string; avatarText?: string }) => Promise<CurrentUser>;
  onTagOptionsChange: (tags: string[]) => void;
  followedUsers: UserSummary[];
  profileSnapshot: Awaited<ReturnType<typeof fetchMyProfile>> | null;
  pet: PetCompanionState;
  petXpToNext: number;
  onShowPet: () => void;
  onHidePet: () => void;
  onFeedPet: () => void;
  onDrinkPet: () => void;
  onOpenPetWardrobe: () => void;
  onPetNameChange: (name: string) => void;
  onPetIntroChange: (intro: string) => void;
  onSettings: () => void;
  onLogout: () => void;
  onOpenUser: (name: string, userId?: string) => void;
  onOpenCard: (cardId: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
  onUpdatePost: (postId: string, patch: Partial<Pick<CommunityPost, "title" | "text" | "channel" | "topic" | "place">>) => Promise<CommunityPost>;
  onDeletePost: (postId: string) => Promise<void>;
  onUpdateCard: (cardId: string, patch: Partial<MealCard>) => Promise<MealCard>;
  onDeleteCard: (cardId: string) => Promise<void>;
}

const avatarOptions = ["我", "U", "饭", "约", "食", "友"];

type ProfileSectionPageId =
  | "posts"
  | "cards"
  | "comments"
  | "liked-posts"
  | "favorite-posts"
  | "comment-interactions";

interface ProfileSectionPage {
  id: ProfileSectionPageId;
  icon: ReactNode;
  title: string;
  empty: string;
  content: ReactNode;
}

export default function Profile({
  currentUser,
  authSummary,
  cards,
  posts,
  comments,
  interactions,
  tagOptions,
  profileTags,
  onProfileTagsChange,
  onAvatarTextChange,
  onProfileUpdate,
  onTagOptionsChange,
  followedUsers,
  profileSnapshot,
  pet,
  petXpToNext,
  onShowPet,
  onHidePet,
  onFeedPet,
  onDrinkPet,
  onOpenPetWardrobe,
  onPetNameChange,
  onPetIntroChange,
  onSettings,
  onLogout,
  onOpenUser,
  onOpenCard,
  onOpenPost,
  onUpdatePost,
  onDeletePost,
  onUpdateCard,
  onDeleteCard,
}: ProfileProps) {
  const myUserId = currentUser?.id;
  const rawMyPosts = posts.filter((post) => myUserId ? post.authorId === myUserId : post.author === currentUser?.nickname);
  const rawMyCards = cards.filter((card) => Boolean(myUserId && card.userId === myUserId));
  const likedPosts = pickPostsByInteractionIds(interactions.likedPostIds, posts, profileSnapshot?.likedPosts);
  const favoritePosts = pickPostsByInteractionIds(interactions.favoritePostIds, posts, profileSnapshot?.favoritePosts);
  const likedComments = pickCommentsByInteractionIds(interactions.likedCommentIds, comments, profileSnapshot?.likedComments);
  const favoriteComments = pickCommentsByInteractionIds(interactions.favoriteCommentIds, comments, profileSnapshot?.favoriteComments);
  const userComments = profileSnapshot?.interactions.userComments ?? interactions.userComments;
  const stats = profileSnapshot?.stats;
  const [avatarText, setAvatarText] = useState(currentUser?.avatarText ?? "我");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [followListOpen, setFollowListOpen] = useState<"followers" | "following" | null>(null);
  const [activeSectionPage, setActiveSectionPage] = useState<ProfileSectionPageId | null>(null);
  const [cardActionId, setCardActionId] = useState("");
  const [cardFeedback, setCardFeedback] = useState("");
  const [postActionId, setPostActionId] = useState("");
  const [cardStatusOverrides, setCardStatusOverrides] = useState<Record<string, MealCard["status"]>>({});
  const [deletedCardIds, setDeletedCardIds] = useState<string[]>([]);
  const [deletedPostIds, setDeletedPostIds] = useState<string[]>([]);
  const [editingCard, setEditingCard] = useState<MealCard | null>(null);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const { homeBackground, setHomeBackground } = useBackgroundPreferences(currentUser?.id);
  const myPosts = rawMyPosts.filter((post) => !deletedPostIds.includes(post.id));
  const myCards = rawMyCards
    .filter((card) => !deletedCardIds.includes(card.id))
    .map((card) => cardStatusOverrides[card.id] ? { ...card, status: cardStatusOverrides[card.id] } : card);

  useEffect(() => {
    setAvatarText(currentUser?.avatarText ?? "我");
    setAvatarUrl(currentUser?.avatarUrl);
    setAvatarOpen(false);
    setProfileEditorOpen(false);
    setTagEditorOpen(false);
    setActiveSectionPage(null);
    setDeletedCardIds([]);
    setDeletedPostIds([]);
    setEditingCard(null);
    setEditingPost(null);
  }, [currentUser?.id, currentUser?.avatarText, currentUser?.avatarUrl]);

  useEffect(() => {
    if (!cardFeedback) return;
    const timer = window.setTimeout(() => setCardFeedback(""), 1800);
    return () => window.clearTimeout(timer);
  }, [cardFeedback]);

  const runCardAction = async (cardId: string, action: () => Promise<unknown>, successMessage: string, optimisticStatus?: MealCard["status"]) => {
    if (cardActionId) return;
    const previousStatus = cardStatusOverrides[cardId] ?? cards.find((card) => card.id === cardId)?.status;
    setCardActionId(cardId);
    setCardFeedback("");
    if (optimisticStatus) {
      setCardStatusOverrides((current) => ({ ...current, [cardId]: optimisticStatus }));
    }
    try {
      const savedCard = await action();
      setCardFeedback(successMessage);
      if (optimisticStatus && isMealCard(savedCard) && savedCard.status) {
        setCardStatusOverrides((current) => ({ ...current, [cardId]: savedCard.status }));
      }
    } catch (error) {
      console.warn("Meal card action failed.", error);
      if (optimisticStatus) {
        setCardStatusOverrides((current) => {
          const next = { ...current };
          if (previousStatus) next[cardId] = previousStatus;
          else delete next[cardId];
          return next;
        });
      }
      setCardFeedback("操作失败，请稍后再试");
    } finally {
      setCardActionId("");
    }
  };

  function isMealCard(value: unknown): value is MealCard {
    return Boolean(value && typeof value === "object" && typeof (value as MealCard).id === "string");
  }

  const deleteCardFromProfile = async (cardId: string) => {
    if (cardActionId) return;
    setCardActionId(cardId);
    setCardFeedback("");
    setDeletedCardIds((current) => current.includes(cardId) ? current : [...current, cardId]);
    try {
      await onDeleteCard(cardId);
      setCardFeedback("已删除约饭卡");
    } catch (error) {
      console.warn("Meal card delete failed.", error);
      setDeletedCardIds((current) => current.filter((id) => id !== cardId));
      setCardFeedback("删除失败，请稍后再试");
    } finally {
      setCardActionId("");
    }
  };

  const deletePostFromProfile = async (postId: string) => {
    if (postActionId) return;
    setPostActionId(postId);
    setCardFeedback("");
    setDeletedPostIds((current) => current.includes(postId) ? current : [...current, postId]);
    try {
      await onDeletePost(postId);
      setEditingPost(null);
      setCardFeedback("已删除帖子");
    } catch (error) {
      console.warn("Profile post delete failed.", error);
      setDeletedPostIds((current) => current.filter((id) => id !== postId));
      setCardFeedback("删除失败，请稍后再试");
    } finally {
      setPostActionId("");
    }
  };

  const editLimitReached = (item: { editCount?: number }) => (item.editCount ?? 0) >= 5;

  const scrollToProfileModule = (moduleIndex: number) => {
    const sections = document.querySelectorAll<HTMLElement>(".profile-shell main > section");
    sections[moduleIndex + 4]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openPostFromProfile = (postId: string, commentsOpen?: boolean) => {
    setActiveSectionPage(null);
    onOpenPost(postId, commentsOpen);
  };

  const openCardFromProfile = (cardId: string) => {
    setActiveSectionPage(null);
    onOpenCard(cardId);
  };

  const likedPostIdSet = new Set([...interactions.likedPostIds, ...likedPosts.map((post) => post.id)]);
  const renderPostActions = (post: CommunityPost) => {
    const editsLeft = Math.max(0, 5 - (post.editCount ?? 0));
    const busy = postActionId === post.id;
    return (
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || editsLeft <= 0}
          onClick={() => editLimitReached(post) ? setCardFeedback("该帖子已编辑 5 次，只能删除") : setEditingPost(post)}
          className="flex h-8 items-center justify-center gap-1 rounded-md bg-[rgba(209,228,221,0.78)] text-xs font-black text-[var(--pine)] disabled:opacity-50"
        >
          <PenLine className="h-3.5 w-3.5" />
          编辑({editsLeft})
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => deletePostFromProfile(post.id)}
          className="flex h-8 items-center justify-center gap-1 rounded-md bg-[rgba(217,154,136,0.16)] text-xs font-black text-[var(--coral)] disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {busy ? "删除中" : "删除"}
        </button>
      </div>
    );
  };

  const renderPostGrid = (items: CommunityPost[], manageable = false) =>
    items.length ? (
      <CommunityPostPreviewGrid
        posts={items}
        onOpenPost={(post) => openPostFromProfile(post.id)}
        isPostLiked={(post) => likedPostIdSet.has(post.id)}
        actionsForPost={manageable ? renderPostActions : undefined}
      />
    ) : null;

  const myPostRows = renderPostGrid(myPosts, true);
  const myPostPreviewRows = renderPostGrid(myPosts.slice(0, 4), true);

  const myCardRows = myCards.map((card) => (
    <MyMealCardRow
      key={card.id}
      card={card}
      expired={isMealCardExpired(card)}
      onOpen={() => openCardFromProfile(card.id)}
      busy={cardActionId === card.id}
      onCloseCard={() => runCardAction(card.id, () => onUpdateCard(card.id, { status: "closed" }), "已关闭展示", "closed")}
      onReopenCard={() => runCardAction(card.id, () => onUpdateCard(card.id, { status: "active" }), "已重新展示", "active")}
      onEdit={() => editLimitReached(card) ? setCardFeedback("该约饭卡已编辑 5 次，只能删除") : setEditingCard(card)}
      onDelete={() => deleteCardFromProfile(card.id)}
    />
  ));

  const userCommentRows = userComments.map((comment) => (
    <button key={comment.id} data-profile-page-action="open-detail" onClick={() => openPostFromProfile(comment.postId, true)} className="w-full rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
      <p className="text-xs font-bold text-[var(--text-faint)]">{comment.postTitle} · {comment.time}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{comment.text}</p>
    </button>
  ));

  const likedPostRows = renderPostGrid(likedPosts);
  const likedPostPreviewRows = renderPostGrid(likedPosts.slice(0, 4));
  const favoritePostRows = renderPostGrid(favoritePosts);
  const favoritePostPreviewRows = renderPostGrid(favoritePosts.slice(0, 4));
  const commentInteractionRows = [...likedComments, ...favoriteComments]
    .filter((comment, index, list) => list.findIndex((item) => item.id === comment.id) === index)
    .map((comment) => (
      <button key={comment.id} data-profile-page-action="open-detail" onClick={() => openPostFromProfile(comment.postId, true)} className="w-full rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
        <p className="text-xs font-bold text-[var(--text-faint)]">{comment.author}</p>
        <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{comment.text}</p>
      </button>
    ));
  const sectionPages: ProfileSectionPage[] = [
    { id: "posts", icon: <PenLine />, title: "我发布的帖子", empty: "还没有发布社区帖子", content: myPostRows },
    { id: "cards", icon: <Utensils />, title: "我发布的约饭卡", empty: "还没有创建约饭卡", content: myCardRows },
    { id: "comments", icon: <MessageCircle />, title: "我发布的评论", empty: "还没有评论", content: userCommentRows },
    { id: "liked-posts", icon: <Heart />, title: "喜欢的帖子", empty: "还没有喜欢的帖子", content: likedPostRows },
    { id: "favorite-posts", icon: <Bookmark />, title: "收藏的帖子", empty: "还没有收藏的帖子", content: favoritePostRows },
    { id: "comment-interactions", icon: <Star />, title: "喜欢/收藏的评论", empty: "还没有互动过评论", content: commentInteractionRows },
  ];
  const activeSection = sectionPages.find((section) => section.id === activeSectionPage);

  return (
    <div className={`app-shell profile-shell relative min-h-[100dvh] ${homeBackground ? "profile-shell-custom-bg" : ""}`}>
      {homeBackground ? (
        <div className="pointer-events-none absolute inset-0 z-0">
          <img src={homeBackground.url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(237,246,242,0.34)_42%,rgba(237,246,242,0.58))]" />
        </div>
      ) : null}
      {activeSection ? (
        <ProfileSectionPageView section={activeSection} onBack={() => setActiveSectionPage(null)} />
      ) : (
      <main className="relative z-10 mx-auto max-w-md px-5 pt-5">
        <ProfileHeader
          nickname={currentUser?.nickname ?? "我"}
          authSummary={authSummary}
          avatarText={avatarText}
          avatarUrl={avatarUrl}
          postCount={myPosts.length}
          cardCount={myCards.length}
          commentCount={stats?.commentCount ?? userComments.length}
          followerCount={stats?.followerCount ?? profileSnapshot?.followers.length ?? followedUsers.length}
          followingCount={stats?.followingCount ?? followedUsers.length}
          onAvatarOpen={() => setAvatarOpen(true)}
          onSettings={onSettings}
          onFollowersOpen={() => setFollowListOpen("followers")}
          onFollowingOpen={() => setFollowListOpen("following")}
          onPostsOpen={() => scrollToProfileModule(0)}
          onCardsOpen={() => scrollToProfileModule(1)}
          onCommentsOpen={() => scrollToProfileModule(2)}
        />
        {cardFeedback ? (
          <p className="mt-3 rounded-lg bg-[rgba(209,228,221,0.72)] px-3 py-2 text-center text-xs font-black text-[var(--pine)]">{cardFeedback}</p>
        ) : null}

        <section className="mt-3 rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-[var(--pine)]">Account</p>
              <p className="mt-1 truncate text-sm font-bold text-[var(--text-main)]">{currentUser?.email ?? "未绑定邮箱"}</p>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">
                {currentUser?.bio || "还没有填写个人简介。"}
              </p>
            </div>
            <button onClick={() => setProfileEditorOpen(true)} className="h-9 shrink-0 rounded-lg bg-[rgba(209,228,221,0.72)] px-3 text-xs font-black text-[var(--pine)]">
              编辑资料
            </button>
          </div>
          <button
            onClick={() => setBackgroundPickerOpen(true)}
            className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[rgba(209,228,221,0.72)] text-sm font-black text-[var(--pine)]"
          >
            <ImageIcon className="h-4 w-4" />
            设置背景
          </button>
          <button onClick={onLogout} className="mt-2 h-10 w-full rounded-lg bg-[rgba(217,154,136,0.16)] text-sm font-black text-[var(--coral)]">
            退出登录
          </button>
        </section>

        <PetManagerCard
          pet={pet}
          xpToNext={petXpToNext}
          onShowPet={onShowPet}
          onHidePet={onHidePet}
          onFeedPet={onFeedPet}
          onDrinkPet={onDrinkPet}
          onOpenWardrobe={onOpenPetWardrobe}
          onPetNameChange={onPetNameChange}
          onPetIntroChange={onPetIntroChange}
          ownerNickname={currentUser?.nickname ?? "我"}
        />

        <section className="profile-liquid-section profile-vapor-mint mt-5">
          <div className="profile-liquid-section-header mb-3 flex items-center justify-between px-1">
            <h2 className="font-black text-[var(--text-main)]">我的偏好</h2>
            <button onClick={() => setTagEditorOpen(true)} className="profile-liquid-more h-8 rounded-lg px-3 text-xs font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]">编辑</button>
          </div>
          <div className="profile-liquid-content flex flex-wrap gap-2">
            {profileTags.length ? (
              profileTags.map((tag, index) => (
                <span
                  key={tag}
                  className={`rounded-lg px-3 py-1.5 text-sm font-black ${
                    index % 3 === 0
                      ? "bg-[rgba(209,228,221,0.9)] text-[var(--pine)]"
                      : index % 3 === 1
                        ? "bg-[rgba(255,247,215,0.86)] text-[#806636]"
                        : "bg-[rgba(183,176,216,0.18)] text-[#6f69a3]"
                  }`}
                >
                  {tag}
                </span>
              ))
            ) : (
              <p className="text-sm font-semibold text-[var(--text-muted)]">还没有设置偏好。</p>
            )}
          </div>
        </section>

        <ProfileSection icon={<PenLine />} title="我发布的帖子" empty="还没有发布社区帖子" onOpenAll={() => setActiveSectionPage("posts")}>
          {myPostPreviewRows}
        </ProfileSection>

        <ProfileSection icon={<Utensils />} title="我发布的约饭卡" empty="还没有创建约饭卡" onOpenAll={() => setActiveSectionPage("cards")}>
          {myCardRows}
        </ProfileSection>

        <ProfileSection icon={<MessageCircle />} title="我发布的评论" empty="还没有评论" onOpenAll={() => setActiveSectionPage("comments")}>
          {userCommentRows}
        </ProfileSection>

        <ProfileSection icon={<Heart />} title="喜欢的帖子" empty="还没有喜欢的帖子" onOpenAll={() => setActiveSectionPage("liked-posts")}>
          {likedPostPreviewRows}
        </ProfileSection>

        <ProfileSection icon={<Bookmark />} title="收藏的帖子" empty="还没有收藏的帖子" onOpenAll={() => setActiveSectionPage("favorite-posts")}>
          {favoritePostPreviewRows}
        </ProfileSection>

        <ProfileSection icon={<Star />} title="喜欢/收藏的评论" empty="还没有互动过评论" onOpenAll={() => setActiveSectionPage("comment-interactions")}>
          {commentInteractionRows}
        </ProfileSection>

      </main>
      )}

      {avatarOpen ? (
        <AvatarEditor
          avatarText={avatarText}
          avatarUrl={avatarUrl}
          onChange={async (value) => {
            setAvatarText(value);
            setAvatarUrl(undefined);
            onAvatarTextChange(value);
            await onProfileUpdate({ avatarText: value, avatarUrl: "" });
          }}
          onUpload={async (file) => {
            const asset = await uploadMedia({
              fileName: file.name,
              mimeType: file.type || "image/jpeg",
              dataBase64: await fileToBase64(file),
              purpose: "avatar",
            });
            setAvatarUrl(asset.url);
            await onProfileUpdate({ avatarUrl: asset.url });
          }}
          onClose={() => setAvatarOpen(false)}
        />
      ) : null}

      {profileEditorOpen && currentUser ? (
        <ProfileInfoEditor
          currentUser={currentUser}
          onClose={() => setProfileEditorOpen(false)}
          onSave={async (input) => {
            await onProfileUpdate(input);
            setProfileEditorOpen(false);
          }}
        />
      ) : null}

      {tagEditorOpen ? (
        <PreferenceTagEditor
          selectedTags={profileTags}
          tagOptions={tagOptions}
          onClose={() => setTagEditorOpen(false)}
          onSave={(nextTags, nextOptions) => {
            onProfileTagsChange(nextTags);
            onTagOptionsChange(nextOptions);
            setTagEditorOpen(false);
          }}
        />
      ) : null}

      {followListOpen ? (
        <FollowListSheet
          title={followListOpen === "followers" ? "粉丝" : "关注"}
          users={followListOpen === "followers" ? profileSnapshot?.followers ?? [] : profileSnapshot?.followedUsers ?? followedUsers}
          onClose={() => setFollowListOpen(null)}
          onOpenUser={(user) => {
            setFollowListOpen(null);
            onOpenUser(user.name, user.userId);
          }}
        />
      ) : null}

      {backgroundPickerOpen ? (
        <BackgroundPickerView
          title="设置主页背景"
          currentBackground={homeBackground}
          onBack={() => setBackgroundPickerOpen(false)}
          onSelect={setHomeBackground}
        />
      ) : null}

      {editingPost ? (
        <ProfilePostEditor
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSave={async (patch) => {
            const savedPost = await onUpdatePost(editingPost.id, patch);
            setEditingPost(null);
            setCardFeedback(`已保存帖子，剩余 ${Math.max(0, 5 - (savedPost.editCount ?? 0))} 次编辑`);
          }}
        />
      ) : null}

      {editingCard ? (
        <ProfileMealCardEditor
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSave={async (patch) => {
            const savedCard = await onUpdateCard(editingCard.id, patch);
            setEditingCard(null);
            setCardFeedback(`已保存约饭卡，剩余 ${Math.max(0, 5 - (savedCard.editCount ?? 0))} 次编辑`);
          }}
        />
      ) : null}
    </div>
  );
}

function ProfileSectionPageView({ section, onBack }: { section: ProfileSectionPage; onBack: () => void }) {
  const toneClass = getProfileSectionTone(section.title);
  const hasContent = Array.isArray(section.content) ? section.content.length > 0 : Boolean(section.content);

  return (
    <main className={`profile-section-page ${toneClass} fixed inset-0 z-30 overflow-y-auto overscroll-contain`}>
      <div className="mx-auto min-h-[100dvh] max-w-md px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-4">
        <header className="profile-section-page-header sticky top-0 z-20 -mx-4 flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="profile-liquid-more safe-tap flex items-center justify-center rounded-lg text-[var(--pine)]" aria-label="返回我的主页">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="profile-liquid-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--pine)] [&>svg]:h-4 [&>svg]:w-4">
            {section.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-[var(--pine)]">Profile</p>
            <h1 className="truncate text-xl font-black text-[var(--text-main)]">{section.title}</h1>
          </div>
        </header>
        <section className="profile-section-page-main -mx-4 min-h-[calc(100dvh-76px)] px-4 py-4">
          {hasContent ? (
            <div className="profile-section-full-list space-y-2">{section.content}</div>
          ) : (
            <p className="rounded-lg bg-white/72 p-4 text-center text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">{section.empty}</p>
          )}
        </section>
      </div>
    </main>
  );
}

function PetManagerCard({
  pet,
  xpToNext,
  onShowPet,
  onHidePet,
  onFeedPet,
  onDrinkPet,
  onOpenWardrobe,
  onPetNameChange,
  onPetIntroChange,
  ownerNickname,
}: {
  pet: PetCompanionState;
  xpToNext: number;
  onShowPet: () => void;
  onHidePet: () => void;
  onFeedPet: () => void;
  onDrinkPet: () => void;
  onOpenWardrobe: () => void;
  onPetNameChange: (name: string) => void;
  onPetIntroChange: (intro: string) => void;
  ownerNickname: string;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(pet.petName || `${ownerNickname}的桌宠`);
  const [editingIntro, setEditingIntro] = useState(false);
  const [introDraft, setIntroDraft] = useState(pet.petIntro);
  const xpPercent = Math.min(100, Math.round((pet.xp / xpToNext) * 100));
  const displayPetName = pet.petName || `${ownerNickname}的桌宠`;

  useEffect(() => {
    if (!editingName) setNameDraft(displayPetName);
  }, [displayPetName, editingName]);

  useEffect(() => {
    if (!editingIntro) setIntroDraft(pet.petIntro);
  }, [editingIntro, pet.petIntro]);

  const saveName = () => {
    const fallbackName = `${ownerNickname}的桌宠`;
    const nextName = nameDraft.trim().slice(0, 16);
    onPetNameChange(nextName === fallbackName ? "" : nextName);
    setNameDraft(nextName || fallbackName);
    setEditingName(false);
  };

  const saveIntro = () => {
    const nextIntro = introDraft.trim().slice(0, 50);
    onPetIntroChange(nextIntro);
    setIntroDraft(nextIntro);
    setEditingIntro(false);
  };

  return (
    <section className="mt-3 rounded-lg bg-[#fff8e5] p-3 ring-1 ring-[#ead7a7]">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white text-[#8a6a20] shadow-[0_10px_20px_rgba(128,102,54,0.12)]">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-black text-[var(--text-main)]">桌宠管家</h2>
            <span className="rounded-md bg-white px-2 py-1 text-[11px] font-black text-[#8a6a20]">Lv.{pet.level}</span>
          </div>
          <div className="mt-2 rounded-lg bg-white/82 p-2 ring-1 ring-[#ead7a7]">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-black text-[var(--text-main)]">{displayPetName}</p>
              <button onClick={() => setEditingName((value) => !value)} className="text-[11px] font-black text-[var(--pine)]">
                {editingName ? "收起" : "改名"}
              </button>
            </div>
            {editingName ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value.slice(0, 16))}
                  maxLength={16}
                  className="h-9 min-w-0 flex-1 rounded-lg bg-[#fffdf6] px-3 text-sm font-semibold text-[var(--text-main)] outline-none ring-1 ring-[#ead7a7]"
                  placeholder={`${ownerNickname}的桌宠`}
                />
                <button onClick={saveName} className="h-9 rounded-lg bg-[var(--pine)] px-3 text-xs font-black text-white">
                  保存
                </button>
              </div>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-1 text-sm font-semibold text-[var(--text-muted)]">{pet.lastLine}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <PetMiniStat label="经验" value={`${pet.xp}/${xpToNext}`} />
            <PetMiniStat label="饱食" value={`${pet.hunger}%`} />
            <PetMiniStat label="心情" value={`${pet.mood}%`} />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#f0c66a,#79b891)]" style={{ width: `${Math.max(3, xpPercent)}%` }} />
          </div>
          <div className="mt-3 rounded-lg bg-white/82 p-2 ring-1 ring-[#ead7a7]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-black text-[#8a6a20]">公开介绍</p>
              <button onClick={() => setEditingIntro((value) => !value)} className="text-[11px] font-black text-[var(--pine)]">
                {editingIntro ? "收起" : "编辑"}
              </button>
            </div>
            {editingIntro ? (
              <div className="mt-2">
                <textarea
                  value={introDraft}
                  onChange={(event) => setIntroDraft(event.target.value.slice(0, 50))}
                  maxLength={50}
                  className="min-h-16 w-full resize-none rounded-lg bg-[#fffdf6] px-3 py-2 text-sm font-semibold text-[var(--text-main)] outline-none ring-1 ring-[#ead7a7]"
                  placeholder="写一句别人点你桌宠时会听到的话"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[var(--text-faint)]">{introDraft.length}/50</span>
                  <button onClick={saveIntro} className="h-8 rounded-lg bg-[var(--pine)] px-3 text-xs font-black text-white">
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--text-muted)]">
                {pet.petIntro || "还没有介绍。别人点你的公开桌宠时，会听到这句话。"}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        <button onClick={onShowPet} className="h-10 rounded-lg bg-[var(--pine)] text-xs font-black text-white">
          {pet.visible ? "定位桌宠" : "打开桌宠"}
        </button>
        <button onClick={onFeedPet} className="h-10 rounded-lg bg-white text-xs font-black text-[#8a6a20]">
          投喂
        </button>
        <button onClick={onDrinkPet} className="h-10 rounded-lg bg-white text-xs font-black text-[#8a6a20]">
          喂水
        </button>
        <button onClick={onOpenWardrobe} className="h-10 rounded-lg bg-white text-xs font-black text-[#8a6a20]">
          衣柜
        </button>
        <button onClick={onHidePet} className="h-10 rounded-lg bg-white text-xs font-black text-[#8a6a20]">
          隐藏
        </button>
      </div>
    </section>
  );
}

function PetMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/82 px-2 py-2">
      <p className="text-[10px] font-black text-[var(--text-faint)]">{label}</p>
      <p className="mt-0.5 text-xs font-black text-[var(--text-main)]">{value}</p>
    </div>
  );
}

function MyMealCardRow({
  card,
  expired,
  onOpen,
  busy,
  onCloseCard,
  onReopenCard,
  onEdit,
  onDelete,
}: {
  card: MealCard;
  expired: boolean;
  onOpen: () => void;
  busy: boolean;
  onCloseCard: () => void;
  onReopenCard: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const closed = card.status === "closed";
  const editsLeft = Math.max(0, 5 - (card.editCount ?? 0));
  const mediaUrl = card.mediaUrl ? resolveMediaUrl(card.mediaUrl) : "";
  return (
    <div className="rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
      <button data-profile-page-action="open-detail" onClick={onOpen} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate font-black text-[var(--text-main)]">{card.place} · {card.time}</p>
          {closed || expired ? (
            <span className="shrink-0 rounded-md bg-[rgba(217,154,136,0.16)] px-2 py-1 text-[11px] font-black text-[var(--coral)]">
              {closed ? "已关闭" : "已过期"}
            </span>
          ) : (
            <span className="shrink-0 rounded-md bg-[rgba(209,228,221,0.72)] px-2 py-1 text-[11px] font-black text-[var(--pine)]">展示中</span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-muted)]">{card.text}</p>
        {mediaUrl ? (
          <div className="mt-3 overflow-hidden rounded-lg bg-white ring-1 ring-[var(--line-soft)]">
            {card.mediaType === "video" ? (
              <div className="relative h-36 bg-black">
                <video src={mediaUrl} className="h-full w-full object-contain" muted playsInline preload="metadata" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/10 text-white">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45">
                    <Play className="h-4 w-4 fill-white" />
                  </span>
                </span>
              </div>
            ) : (
              <div className="h-36 bg-white">
                <img src={mediaUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
              </div>
            )}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-[rgba(209,228,221,0.72)] px-2 py-1 text-[11px] font-black text-[var(--pine)]">{tag}</span>
          ))}
        </div>
      </button>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          disabled={busy}
          onClick={closed ? onReopenCard : onCloseCard}
          className="h-9 rounded-lg bg-[rgba(209,228,221,0.72)] text-xs font-black text-[var(--pine)] disabled:opacity-50"
        >
          {busy ? "处理中..." : closed ? "重新展示" : "关闭展示"}
        </button>
        <button
          disabled={busy || editsLeft <= 0}
          onClick={onEdit}
          className="h-9 rounded-lg bg-[rgba(209,228,221,0.72)] text-xs font-black text-[var(--pine)] disabled:opacity-50"
        >
          编辑（{editsLeft}）
        </button>
        <button
          disabled={busy}
          onClick={onDelete}
          className="flex h-9 items-center justify-center gap-1 rounded-lg bg-[rgba(217,154,136,0.16)] text-xs font-black text-[var(--coral)] disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除
        </button>
      </div>
    </div>
  );
}

function FollowListSheet({
  title,
  users,
  onClose,
  onOpenUser,
}: {
  title: string;
  users: UserSummary[];
  onClose: () => void;
  onOpenUser: (user: UserSummary) => void;
}) {
  const { sheetProps } = useSheetDragToClose(onClose);

  return (
    <div className={`app-bottom-sheet fixed inset-0 z-[80] flex items-end bg-[rgba(18,30,25,0.34)] px-3 ${sheetProps.className}`}>
      <section {...sheetProps} className="mx-auto max-h-[78dvh] w-full max-w-md overflow-hidden rounded-lg bg-[var(--surface)] shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <header className="flex items-center justify-between border-b border-[var(--line-soft)] px-4 py-3">
          <h2 className="display-cn text-[22px] text-[var(--text-main)]">{title}</h2>
          <button data-sheet-dismiss onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div data-sheet-scroll className="max-h-[64dvh] overflow-y-auto p-4">
          {users.length ? (
            <div className="space-y-2">
              {users.map((user) => (
                <button key={user.userId ?? user.name} onClick={() => onOpenUser(user)} className="flex w-full items-center gap-3 rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
                  <div className="display-cn flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-[#28483f]">
                    {user.avatarUrl ? <img src={resolveAvatarUrl(user.avatarUrl)} alt={user.name} className="h-full w-full rounded-full object-cover" /> : user.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-[var(--text-main)]">{user.name}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text-muted)]">{user.school ?? user.source ?? "校园用户"}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-white/72 p-4 text-center text-sm font-semibold text-[var(--text-muted)]">暂时还没有用户</p>
          )}
        </div>
      </section>
    </div>
  );
}

function isMealCardExpired(card: MealCard) {
  const explicitDate = card.time.trim().match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!explicitDate) return false;
  const cardDate = new Date(Number(explicitDate[1]), Number(explicitDate[2]) - 1, Number(explicitDate[3]) + 1).getTime();
  return Number.isFinite(cardDate) && cardDate < Date.now();
}

function pickPostsByInteractionIds(ids: string[], localPosts: CommunityPost[], snapshotPosts: CommunityPost[] = []) {
  const postById = new Map([...snapshotPosts, ...localPosts].map((post) => [post.id, post]));
  return ids.map((id) => postById.get(id)).filter((post): post is CommunityPost => Boolean(post));
}

function pickCommentsByInteractionIds(ids: string[], localComments: CommunityComment[], snapshotComments: CommunityComment[] = []) {
  const commentById = new Map([...snapshotComments, ...localComments].map((comment) => [comment.id, comment]));
  return ids.map((id) => commentById.get(id)).filter((comment): comment is CommunityComment => Boolean(comment));
}

function ProfilePostEditor({
  post,
  onClose,
  onSave,
}: {
  post: CommunityPost;
  onClose: () => void;
  onSave: (patch: Partial<Pick<CommunityPost, "title" | "text" | "channel" | "topic" | "place">>) => Promise<void>;
}) {
  const [title, setTitle] = useState(post.title);
  const [text, setText] = useState(post.text);
  const [place, setPlace] = useState(post.place);
  const [topic, setTopic] = useState(post.topic);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { sheetProps } = useSheetDragToClose(onClose);

  return (
    <div className={`app-bottom-sheet fixed inset-0 z-[75] flex items-end bg-[rgba(18,30,25,0.34)] px-3 ${sheetProps.className}`}>
      <section {...sheetProps} className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <SheetEditorHeader title="编辑帖子" onClose={onClose} />
        <div className="space-y-3">
          <Field label="标题" value={title} onChange={setTitle} maxLength={60} />
          <label className="block">
            <span className="mb-1 block text-xs font-black text-[var(--text-muted)]">正文</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={500}
              className="min-h-28 w-full resize-none rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)]"
            />
          </label>
          <div className="grid grid-cols-[1fr_112px] gap-2">
            <Field label="地点" value={place} onChange={setPlace} maxLength={40} />
            <label className="block">
              <span className="mb-1 block text-xs font-black text-[var(--text-muted)]">话题</span>
              <select value={topic} onChange={(event) => setTopic(event.target.value as CommunityPost["topic"])} className="h-11 w-full rounded-lg bg-white px-2 text-sm font-black outline-none ring-1 ring-[var(--line-soft)]">
                <option value="餐厅">餐厅</option>
                <option value="生活">生活</option>
                <option value="经验">经验</option>
              </select>
            </label>
          </div>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-[rgba(217,154,136,0.16)] px-3 py-2 text-center text-xs font-black text-[var(--coral)]">{error}</p> : null}
        <button
          disabled={saving}
          onClick={async () => {
            if (title.trim().length < 4 || text.trim().length < 6) {
              setError("标题至少 4 个字，正文至少 6 个字。");
              return;
            }
            setSaving(true);
            setError("");
            try {
              await onSave({ title: title.trim(), text: text.trim(), place: place.trim() || "校园", topic, channel: topic });
            } catch (error) {
              console.warn("Profile post edit failed.", error);
              setError("保存失败，请稍后再试。");
            } finally {
              setSaving(false);
            }
          }}
          className="mt-4 h-11 w-full rounded-lg bg-[var(--pine)] text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存修改"}
        </button>
      </section>
    </div>
  );
}

function ProfileMealCardEditor({
  card,
  onClose,
  onSave,
}: {
  card: MealCard;
  onClose: () => void;
  onSave: (patch: Partial<MealCard>) => Promise<void>;
}) {
  const [text, setText] = useState(card.text);
  const [time, setTime] = useState(card.time);
  const [place, setPlace] = useState(card.place);
  const [people, setPeople] = useState(card.people);
  const [tags, setTags] = useState(card.tags.join("，"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { sheetProps } = useSheetDragToClose(onClose);

  return (
    <div className={`app-bottom-sheet fixed inset-0 z-[75] flex items-end bg-[rgba(18,30,25,0.34)] px-3 ${sheetProps.className}`}>
      <section {...sheetProps} className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <SheetEditorHeader title="编辑约饭卡" onClose={onClose} />
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-black text-[var(--text-muted)]">邀请文案</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={220}
              className="min-h-24 w-full resize-none rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="时间" value={time} onChange={setTime} maxLength={40} />
            <Field label="人数" value={people} onChange={setPeople} maxLength={20} />
          </div>
          <Field label="地点" value={place} onChange={setPlace} maxLength={40} />
          <Field label="标签（用逗号分隔）" value={tags} onChange={setTags} maxLength={80} />
        </div>
        {error ? <p className="mt-3 rounded-lg bg-[rgba(217,154,136,0.16)] px-3 py-2 text-center text-xs font-black text-[var(--coral)]">{error}</p> : null}
        <button
          disabled={saving}
          onClick={async () => {
            const nextTags = tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
            if (!text.trim() || !time.trim() || !place.trim() || !people.trim() || !nextTags.length) {
              setError("请完整填写文案、时间、地点、人数和标签。");
              return;
            }
            setSaving(true);
            setError("");
            try {
              await onSave({ text: text.trim(), time: time.trim(), place: place.trim(), people: people.trim(), tags: nextTags });
            } catch (error) {
              console.warn("Profile meal card edit failed.", error);
              setError("保存失败，请稍后再试。");
            } finally {
              setSaving(false);
            }
          }}
          className="mt-4 h-11 w-full rounded-lg bg-[var(--pine)] text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存修改"}
        </button>
      </section>
    </div>
  );
}

function SheetEditorHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-xs font-bold uppercase text-[var(--pine)]">Edit</p>
        <h2 className="display-cn text-[22px] text-[var(--text-main)]">{title}</h2>
      </div>
      <button data-sheet-dismiss onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function AvatarEditor({
  avatarText,
  avatarUrl,
  onChange,
  onUpload,
  onClose,
}: {
  avatarText: string;
  avatarUrl?: string;
  onChange: (value: string) => void | Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const { sheetProps } = useSheetDragToClose(onClose);

  return (
    <div className={`app-bottom-sheet fixed inset-0 z-[75] flex items-end bg-[rgba(18,30,25,0.34)] px-3 ${sheetProps.className}`}>
      <section {...sheetProps} className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">Avatar</p>
            <h2 className="display-cn text-[22px] text-[var(--text-main)]">查看和更换头像</h2>
          </div>
          <button data-sheet-dismiss onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="display-cn flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-5xl text-[#28483f] shadow-[0_14px_30px_rgba(90,130,114,0.18)]">
            {avatarUrl ? <img src={resolveAvatarUrl(avatarUrl)} alt="头像预览" className="h-full w-full object-cover" /> : avatarText}
          </div>
          <label className="mt-3 flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[rgba(209,228,221,0.72)] px-4 text-sm font-black text-[var(--pine)]">
            <Camera className="h-4 w-4" />
            {uploading ? "上传中..." : "从相册更换"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  await onUpload(file);
                } finally {
                  setUploading(false);
                  event.target.value = "";
                }
              }}
            />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-6 gap-2">
          {avatarOptions.map((option) => {
            const selected = !avatarUrl && avatarText === option;
            return (
              <button
                key={option}
                onClick={() => onChange(option)}
                className={`display-cn flex h-12 items-center justify-center rounded-lg text-xl font-black ring-1 ${
                  selected
                    ? "bg-[var(--pine)] text-white ring-[var(--pine)]"
                    : "bg-white/82 text-[var(--pine)] ring-[var(--line-soft)]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ProfileInfoEditor({
  currentUser,
  onClose,
  onSave,
}: {
  currentUser: CurrentUser;
  onClose: () => void;
  onSave: (input: { nickname: string; school: string; bio: string }) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [school, setSchool] = useState(currentUser.schoolName);
  const [bio, setBio] = useState(currentUser.bio ?? "");
  const [saving, setSaving] = useState(false);
  const { sheetProps } = useSheetDragToClose(onClose);

  return (
    <div className={`app-bottom-sheet fixed inset-0 z-[75] flex items-end bg-[rgba(18,30,25,0.34)] px-3 ${sheetProps.className}`}>
      <section {...sheetProps} className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">Profile</p>
            <h2 className="display-cn text-[22px] text-[var(--text-main)]">编辑资料</h2>
          </div>
          <button data-sheet-dismiss onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="昵称" value={nickname} onChange={setNickname} maxLength={24} />
          <Field label="学校" value={school} onChange={setSchool} maxLength={40} />
          <label className="block">
            <span className="mb-1 block text-xs font-black text-[var(--text-muted)]">个人简介</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={120}
              className="min-h-24 w-full resize-none rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)]"
              placeholder="写一点你喜欢的口味、饭点和聊天方式"
            />
          </label>
        </div>

        <button
          disabled={saving || !nickname.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({ nickname: nickname.trim(), school: school.trim(), bio: bio.trim() });
            } finally {
              setSaving(false);
            }
          }}
          className="mt-4 h-11 w-full rounded-lg bg-[var(--pine)] text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存资料"}
        </button>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-[var(--text-muted)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        className="h-11 w-full rounded-lg bg-white px-3 text-sm font-semibold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)]"
      />
    </label>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

