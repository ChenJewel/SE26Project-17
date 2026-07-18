import { BadgeCheck, ChevronLeft, Clock3, Image as ImageIcon, MapPin, PenLine, Play, ShieldAlert, Sparkles, Utensils, Video, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { PostDetailView } from "@/components/post/PostDetailView";
import { getProfileSectionTone, ProfileSection } from "@/components/profile/ProfileSection";
import UserAvatar from "@/components/UserAvatar";
import type { CommunityComment, CommunityInteractionState, CommunityPost } from "@/data/community";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { fetchPublicUser, type FollowSummary } from "@/services/userApi";
import type { MealCard } from "@/types/meal";
import type { DetailTarget } from "@/types/navigation";
import type { UserSummary } from "@/types/user";

interface ContentDetailOverlayProps {
  target: DetailTarget | null;
  cards: MealCard[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  interactions: CommunityInteractionState;
  followedUserNames: string[];
  onPublishComment: (post: CommunityPost, text: string, parentCommentId?: string) => Promise<CommunityComment>;
  onTogglePostLike: (postId: string) => void;
  onTogglePostFavorite: (postId: string) => void;
  onToggleCommentLike: (commentId: string) => void;
  onToggleCommentFavorite: (commentId: string) => void;
  onSharePost: (postId: string) => void;
  onDeleteComment: (commentId: string) => Promise<void>;
  onFollowUser: (user: UserSummary) => void;
  onMessageUser: (user: UserSummary) => void;
  onOpenUser: (name: string, userId?: string) => void;
  onInviteCard: (card: MealCard) => void | Promise<void>;
  onOpenCard: (cardId: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
  currentUserId?: string;
  currentUserRole?: string;
  onClose: () => void;
}

interface LoadedUser {
  summary: UserSummary;
  follow?: FollowSummary;
  bio?: string;
  school?: string;
  preferenceTags?: string[];
}

type UserProfileSectionPageId = "cards" | "posts";

interface UserProfileSectionPage {
  id: UserProfileSectionPageId;
  icon: ReactNode;
  title: string;
  empty: string;
  content: ReactNode;
}

function project(initialVelocity: number, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

export default function ContentDetailOverlay({
  target,
  cards,
  posts,
  comments,
  interactions,
  followedUserNames,
  onPublishComment,
  onTogglePostLike,
  onTogglePostFavorite,
  onToggleCommentLike,
  onToggleCommentFavorite,
  onSharePost,
  onDeleteComment,
  onFollowUser,
  onMessageUser,
  onOpenUser,
  onInviteCard,
  onOpenCard,
  onOpenPost,
  currentUserId,
  currentUserRole,
  onClose,
}: ContentDetailOverlayProps) {
  const [loadedUser, setLoadedUser] = useState<LoadedUser | null>(null);
  const [localFollow, setLocalFollow] = useState<FollowSummary | undefined>();
  const [commentDraft, setCommentDraft] = useState("");
  const [videoCommentsOpen, setVideoCommentsOpen] = useState(false);
  const [panelX, setPanelX] = useState(0);
  const [panelDragging, setPanelDragging] = useState(false);
  const panelStart = useRef<{ x: number; y: number } | null>(null);
  const panelActive = useRef(false);
  const panelHistory = useRef<Array<{ x: number; t: number }>>([]);

  const loadTargetUser = useCallback(async (userId: string, cancelled: () => boolean) => {
    const result = await fetchPublicUser(userId);
    if (cancelled()) return;
    setLoadedUser({
      summary: result.summary,
      follow: result.follow,
      bio: result.user.bio,
      school: result.user.school,
    });
    setLocalFollow(result.follow);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadedUser(null);
    setLocalFollow(undefined);
    if (target?.type !== "user" || !target.userId) return;

    loadTargetUser(target.userId, () => cancelled)
      .catch((error) => {
        if (!cancelled) console.warn("Failed to load public user.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [loadTargetUser, target]);

  useEffect(() => {
    if (target?.type !== "user" || !target.userId) return;
    return subscribeRealtimeEvents((event) => {
      if (event.type === "user.profile.updated" && isUserProfileUpdatedEvent(event.data)) {
        if (event.data.user.id === target.userId) {
          loadTargetUser(target.userId!, () => false).catch((error) => console.warn("Failed to refresh public user.", error));
        }
        return;
      }

      if (event.type === "user.follow.updated" && isUserFollowUpdatedEvent(event.data)) {
        if (event.data.followerUserId === target.userId || event.data.followingUserId === target.userId) {
          loadTargetUser(target.userId!, () => false).catch((error) => console.warn("Failed to refresh public user follow state.", error));
        }
      }
    });
  }, [loadTargetUser, target]);

  useEffect(() => {
    setVideoCommentsOpen(Boolean(target?.type === "post" && target.commentsOpen));
  }, [target]);

  if (!target) return null;

  const card = target.type === "card" ? cards.find((item) => item.id === target.cardId) : null;
  const post = target.type === "post" ? posts.find((item) => item.id === target.postId) : null;
  const userName = target.type === "user" ? (loadedUser?.summary.name ?? target.name) : card?.nickname ?? post?.author ?? "";

  if (target.type === "post" && post?.mediaType === "video") {
    return (
      <PostDetailView
        post={post}
        comments={comments.filter((comment) => comment.postId === post.id)}
        commentsOpen={videoCommentsOpen}
        videoFeedPosts={posts.filter((item) => item.mediaType === "video")}
        variant="overlay"
        interactions={interactions}
        commentDraft={commentDraft}
        onCommentDraftChange={setCommentDraft}
        onClose={onClose}
        onOpenComments={() => setVideoCommentsOpen(true)}
        onCloseComments={() => setVideoCommentsOpen(false)}
        onVideoFeedPostChange={(nextPost) => {
          setVideoCommentsOpen(false);
          onOpenPost(nextPost.id);
        }}
        onLikePost={() => onTogglePostLike(post.id)}
        onFavoritePost={() => onTogglePostFavorite(post.id)}
        onSharePost={() => onSharePost(post.id)}
        onPublishComment={async (parentCommentId) => {
          await onPublishComment(post, commentDraft, parentCommentId);
          setCommentDraft("");
        }}
        onLikeComment={onToggleCommentLike}
        onFavoriteComment={onToggleCommentFavorite}
        onDeleteComment={onDeleteComment}
        onOpenUser={onOpenUser}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />
    );
  }

  const resetPanelDrag = () => {
    panelStart.current = null;
    panelActive.current = false;
    panelHistory.current = [];
    setPanelDragging(false);
    setPanelX(0);
  };

  const beginPanelDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    panelStart.current = { x: event.clientX, y: event.clientY };
    panelHistory.current = [{ x: event.clientX, t: performance.now() }];
  };

  const movePanelDrag = (event: PointerEvent<HTMLElement>) => {
    if (!panelStart.current) return;
    const dx = event.clientX - panelStart.current.x;
    const dy = event.clientY - panelStart.current.y;

    if (!panelActive.current) {
      if (Math.abs(dx) < 10) return;
      if (dx < 0 || Math.abs(dy) > Math.abs(dx)) {
        resetPanelDrag();
        return;
      }
      panelActive.current = true;
      setPanelDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    const nextX = Math.max(0, Math.min(180, dx));
    setPanelX(nextX);
    panelHistory.current = [...panelHistory.current, { x: event.clientX, t: performance.now() }].slice(-5);
  };

  const finishPanelDrag = (event: PointerEvent<HTMLElement>) => {
    if (!panelStart.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }

    const samples = panelHistory.current;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const velocity = first && last && last.t !== first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0;
    const projected = panelX + project(velocity);
    if (panelX > 92 || projected > 150 || velocity > 760) onClose();
    else resetPanelDrag();
  };

  return (
    <div
      className="app-screen-overlay fixed inset-0 z-[80] bg-[rgba(18,30,25,0.32)]"
      style={{ opacity: 1 - Math.min(0.28, panelX / 520) }}
    >
      <section
        className="app-push-panel mx-auto flex h-full max-w-md flex-col bg-[rgba(251,255,252,0.94)] shadow-[0_20px_60px_rgba(18,30,25,0.22)]"
        style={{
          transform: panelX ? `translate3d(${panelX}px, 0, 0)` : undefined,
          transition: panelDragging ? "none" : "transform 360ms var(--spring-soft)",
        } as CSSProperties}
        onPointerDown={beginPanelDrag}
        onPointerMove={movePanelDrag}
        onPointerUp={finishPanelDrag}
        onPointerCancel={resetPanelDrag}
      >
        <header className="page-header flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">
              {target.type === "user" ? "User" : target.type === "card" ? "Meal Card" : "Post"}
            </p>
            <h1 className="display-cn text-[22px] text-[var(--text-main)]">
              {target.type === "user" ? `${userName} 的主页` : target.type === "card" ? "约饭卡详情" : "帖子详情"}
            </h1>
          </div>
          <button
            onClick={onClose}
            className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]"
            aria-label="关闭详情"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {target.type === "user" ? (
            <UserDetail
              targetName={target.name}
              userId={target.userId}
              loadedUser={loadedUser}
              cards={cards}
              posts={posts}
              followed={followedUserNames.includes(userName)}
              localFollow={localFollow}
              onFollowUser={onFollowUser}
              onFollowChange={setLocalFollow}
              onMessageUser={onMessageUser}
              onInviteCard={onInviteCard}
              onOpenCard={onOpenCard}
              onOpenPost={onOpenPost}
            />
          ) : null}
          {target.type === "card" && card ? <CardDetail card={card} onOpenUser={onOpenUser} /> : null}
          {target.type === "post" && post ? (
            <PostDetailView
              post={post}
              comments={comments.filter((comment) => comment.postId === post.id)}
              commentsOpen={target.commentsOpen}
              variant="embedded"
              interactions={interactions}
              commentDraft={commentDraft}
              onCommentDraftChange={setCommentDraft}
              onLikePost={() => onTogglePostLike(post.id)}
              onFavoritePost={() => onTogglePostFavorite(post.id)}
              onSharePost={() => onSharePost(post.id)}
              onPublishComment={async (parentCommentId) => {
                await onPublishComment(post, commentDraft, parentCommentId);
                setCommentDraft("");
              }}
              onLikeComment={onToggleCommentLike}
              onFavoriteComment={onToggleCommentFavorite}
              onDeleteComment={onDeleteComment}
              onOpenUser={onOpenUser}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ) : null}
        </main>
      </section>
    </div>
  );
}

function UserDetail({
  targetName,
  userId,
  loadedUser,
  cards,
  posts,
  followed,
  localFollow,
  onFollowUser,
  onFollowChange,
  onMessageUser,
  onInviteCard,
  onOpenCard,
  onOpenPost,
}: {
  targetName: string;
  userId?: string;
  loadedUser: LoadedUser | null;
  cards: MealCard[];
  posts: CommunityPost[];
  followed: boolean;
  localFollow?: FollowSummary;
  onFollowUser: (user: UserSummary) => void;
  onFollowChange: (follow: FollowSummary) => void;
  onMessageUser: (user: UserSummary) => void;
  onInviteCard: (card: MealCard) => void | Promise<void>;
  onOpenCard: (cardId: string) => void;
  onOpenPost: (postId: string) => void;
}) {
  const [inviteState, setInviteState] = useState<"idle" | "sending" | "sent" | "empty">("idle");
  const { userCards, userPosts } = useMemo(() => {
    const byCardOwner = (card: MealCard) => userId ? card.userId === userId : card.nickname === targetName;
    const byPostAuthor = (post: CommunityPost) => userId ? post.authorId === userId : post.author === targetName;
    return {
      userCards: cards.filter(byCardOwner),
      userPosts: posts.filter(byPostAuthor),
    };
  }, [cards, posts, targetName, userId]);

  const name = loadedUser?.summary.name ?? userCards[0]?.nickname ?? userPosts[0]?.author ?? targetName;
  const avatar = loadedUser?.summary.avatar ?? userCards[0]?.avatarText ?? userPosts[0]?.avatar ?? name.slice(0, 1);
  const avatarUrl = loadedUser?.summary.avatarUrl;
  const source = loadedUser?.school ?? loadedUser?.summary.source ?? userCards[0]?.place ?? userPosts[0]?.place ?? "校园用户";
  const tags = Array.from(new Set(userCards.flatMap((card) => card.tags).slice(0, 8)));
  const sharedTags = tags.filter((tag) => ["晚饭", "不吃辣", "二食堂", "喜欢安静", "社恐友好", "清淡"].includes(tag));
  const follow = localFollow ?? loadedUser?.follow;
  const isFollowing = follow?.following ?? followed;
  const relationLabel = follow?.mutual ? "互相关注" : follow?.following ? "已关注" : follow?.followedBy ? "关注了你" : "未关注";
  const followerCount = follow?.followerCount ?? Math.max(0, 18 + userCards.length * 4 + userPosts.length * 3);
  const followingCount = follow?.followingCount ?? Math.max(0, 12 + userPosts.length * 2);
  const relationScore = Math.min(98, 72 + userCards.length * 4 + userPosts.length * 3 + sharedTags.length * 2);
  const inviteCard = userCards.find((card) => (card.status ?? "active") === "active") ?? userCards[0];
  const inviteLabel = inviteState === "sending" ? "发起中..." : inviteState === "sent" ? "已发送邀请" : inviteState === "empty" ? "暂无约饭卡" : "发起约饭";

  const handleInvite = async () => {
    if (inviteState === "sending") return;
    if (!inviteCard) {
      setInviteState("empty");
      window.setTimeout(() => setInviteState("idle"), 1400);
      return;
    }

    try {
      setInviteState("sending");
      await onInviteCard(inviteCard);
      setInviteState("sent");
    } catch (error) {
      console.warn("Failed to create meal invite from user detail.", error);
      setInviteState("idle");
    }
  };

  return (
    <div className="space-y-5">
      <section className="meal-card rounded-lg p-5">
        <div className="card-content flex items-center gap-4">
          <UserAvatar text={avatar} imageUrl={avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="display-cn truncate text-[25px] text-[#fffdf3]">{name}</h2>
              {loadedUser?.summary.verified && <BadgeCheck className="h-5 w-5 shrink-0 fill-[#d5b66f] text-[#365d51]" />}
            </div>
            <p className="mt-1 truncate text-sm font-bold text-[#d8eade]">{source}</p>
            {loadedUser?.bio ? <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-[#fffdf3]">{loadedUser.bio}</p> : null}
          </div>
        </div>
        <div className="card-content mt-5 grid grid-cols-3 gap-3">
          <Stat value={String(userCards.length)} label="约饭卡" />
          <Stat value={String(userPosts.length)} label="帖子" />
          <Stat value={`${relationScore}%`} label="匹配" />
        </div>
        <div className="card-content mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              onFollowChange({
                following: true,
                followedBy: Boolean(follow?.followedBy),
                mutual: Boolean(follow?.followedBy),
                followerCount,
                followingCount,
              });
              onFollowUser({ userId, name, avatar, avatarUrl, source, verified: loadedUser?.summary.verified ?? true });
            }}
            className={`h-11 rounded-lg text-sm font-black ${
              isFollowing ? "bg-white/18 text-[#fffdf3]" : "bg-[#fff7d7] text-[#28483f]"
            }`}
          >
            {follow?.mutual ? "互相关注" : isFollowing ? "已关注" : "关注"}
          </button>
          <button
            disabled={!userId}
            onClick={() => onMessageUser({ userId, name, avatar, avatarUrl, source, verified: loadedUser?.summary.verified ?? true })}
            className="h-11 rounded-lg bg-white/18 text-sm font-black text-[#fffdf3] disabled:opacity-45"
          >
            私信
          </button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <ProfileMetric value={String(followingCount)} label="关注" />
        <ProfileMetric value={String(followerCount)} label="粉丝" />
        <ProfileMetric value={relationLabel} label="关系" />
      </section>

      <section className="grid grid-cols-3 gap-2">
        <button
          onClick={handleInvite}
          disabled={inviteState === "sending"}
          className="rounded-lg bg-white/82 p-3 text-center text-xs font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)] disabled:opacity-60"
        >
          发起约饭
        </button>
        <button className="rounded-lg bg-white/82 p-3 text-center text-xs font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]">
          屏蔽
        </button>
        <button className="flex items-center justify-center gap-1 rounded-lg bg-white/82 p-3 text-center text-xs font-black text-[var(--coral)] ring-1 ring-[var(--line-soft)]">
          <ShieldAlert className="h-3.5 w-3.5" />
          举报
        </button>
      </section>

      {inviteState !== "idle" ? (
        <p className="rounded-lg bg-[rgba(209,228,221,0.72)] px-3 py-2 text-center text-xs font-black text-[var(--pine)]">
          {inviteLabel}
        </p>
      ) : null}

      {sharedTags.length ? (
        <section>
          <h3 className="mb-2 px-1 font-black text-[var(--text-main)]">共同偏好</h3>
          <div className="flex flex-wrap gap-2">
            {sharedTags.map((tag) => (
              <span key={tag} className="rounded-lg bg-[rgba(255,247,215,0.86)] px-3 py-1.5 text-sm font-black text-[#806636]">
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {tags.length ? (
        <section>
          <h3 className="mb-2 px-1 font-black text-[var(--text-main)]">常用标签</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-lg bg-[rgba(209,228,221,0.8)] px-3 py-1.5 text-sm font-black text-[var(--pine)]">
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <ContentList title="约饭卡片">
        {userCards.map((card) => (
          <button key={card.id} onClick={() => onOpenCard(card.id)} className="w-full rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
            <p className="font-black text-[var(--text-main)]">{card.place} · {card.time}</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{card.text}</p>
            <MealCardMiniMedia card={card} />
          </button>
        ))}
      </ContentList>

      <ContentList title="发布的帖子">
        {userPosts.map((post) => (
          <button key={post.id} onClick={() => onOpenPost(post.id)} className="w-full rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
            <p className="font-black text-[var(--text-main)]">{post.title}</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{post.text}</p>
          </button>
        ))}
      </ContentList>
    </div>
  );
}

function ProfileMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-white/82 p-3 text-center ring-1 ring-[var(--line-soft)]">
      <p className="text-lg font-black text-[var(--text-main)]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function MealCardMiniMedia({ card }: { card: MealCard }) {
  if (!card.mediaUrl || !card.mediaType) return null;
  const mediaUrl = resolveMediaUrl(card.mediaUrl);

  return (
    <div className="mt-3 overflow-hidden rounded-lg bg-white ring-1 ring-[var(--line-soft)]">
      {card.mediaType === "video" ? (
        <div className="relative h-32 bg-black">
          <video src={mediaUrl} className="h-full w-full object-contain" muted playsInline preload="metadata" />
          <span className="absolute inset-0 flex items-center justify-center text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45">
              <Play className="h-4 w-4 fill-white" />
            </span>
          </span>
        </div>
      ) : (
        <div className="h-32 bg-white">
          <img src={mediaUrl} alt="约饭卡媒体" className="h-full w-full object-contain" loading="lazy" />
        </div>
      )}
    </div>
  );
}

function CardDetail({ card, onOpenUser }: { card: MealCard; onOpenUser: (name: string, userId?: string) => void }) {
  const mediaUrl = card.mediaUrl && card.mediaType ? resolveMediaUrl(card.mediaUrl) : "";
  return (
    <article className="home-meal-card-tone meal-card rounded-lg p-5">
      <div className="card-content flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => onOpenUser(card.nickname, card.userId)}
            className="flex shrink-0 items-center justify-center rounded-lg"
            aria-label={`查看${card.nickname}主页`}
          >
            <UserAvatar text={card.avatarText} imageUrl={card.avatarUrl} />
          </button>
          <div className="min-w-0">
            <h2 className="display-cn truncate text-[23px] text-[#fffdf3]">{card.nickname}</h2>
            <p className="text-xs font-bold text-[#d8eade]">{card.reason}</p>
          </div>
        </div>
        <span className="rounded-lg bg-white/14 px-3 py-2 text-xl font-black">{card.matchScore}%</span>
      </div>
      <div className="card-content mt-4 grid grid-cols-2 gap-2 text-white">
        <DetailInfoPill icon={<Clock3 className="h-4 w-4" />} label="时间" text={card.time} />
        <DetailInfoPill icon={<MapPin className="h-4 w-4" />} label="地点" text={card.place} />
        <DetailInfoPill icon={<Utensils className="h-4 w-4" />} label="人数" text={card.people} />
        <DetailInfoPill icon={<Sparkles className="h-4 w-4" />} label="节奏" text="相近" />
      </div>
      <div className="card-content mt-5 rounded-lg border border-white/20 bg-white/[0.10] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-4xl font-black leading-none text-white/24">“</span>
          <p className="text-[11px] font-black uppercase text-white/52">invitation</p>
        </div>
        <div className="-mt-0.5 pr-1">
          <p className="text-xl font-black leading-[1.42] text-[#fffdf3]">{card.text}</p>
        </div>
        {mediaUrl ? (
          <div className="mt-4 overflow-hidden rounded-lg bg-white ring-1 ring-white/18">
            {card.mediaType === "video" ? (
              <video src={mediaUrl} controls playsInline className="max-h-[72dvh] w-full object-contain" />
            ) : (
              <img src={mediaUrl} alt="约饭卡媒体" className="max-h-[72dvh] w-full object-contain" />
            )}
            <div className="flex items-center gap-2 bg-white/92 px-3 py-2 text-xs font-black text-[var(--pine)]">
              {card.mediaType === "video" ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              {card.mediaType === "video" ? "视频约饭卡" : "照片约饭卡"}
            </div>
          </div>
        ) : null}
      </div>
      <div className="card-content mt-5 flex flex-wrap gap-2">
        {card.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-white/24 bg-white/12 px-3 py-1.5 text-sm font-bold text-white/88">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

function ContentList({ title, children }: { title: string; children: ReactNode }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section>
      <h3 className="mb-2 px-1 font-black text-[var(--text-main)]">{title}</h3>
      <div className="space-y-2">
        {hasContent ? children : (
          <div className="rounded-lg bg-white/72 p-4 text-center text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
            暂时没有内容
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-[rgba(255,255,255,0.12)] p-3 text-center ring-1 ring-[rgba(255,255,255,0.16)]">
      <p className="text-xl font-black text-[#fffdf3]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#d8eade]">{label}</p>
    </div>
  );
}

function DetailInfoPill({ icon, label, text }: { icon: ReactNode; label: string; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/24 bg-white/[0.14] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/16 text-white/86">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-black leading-none text-white/50">{label}</span>
        <span className="mt-1 block truncate text-sm font-black leading-tight text-white/92">{text}</span>
      </span>
    </div>
  );
}

function Meta({ label }: { label: string }) {
  return <span className="rounded-lg bg-white/12 px-3 py-2 text-center text-xs font-black text-white/86">{label}</span>;
}

function isUserProfileUpdatedEvent(data: unknown): data is { user: { id: string; nickname: string; avatarText: string; avatarUrl?: string; verified: boolean } } {
  if (!data || typeof data !== "object") return false;
  const user = (data as { user?: unknown }).user;
  return Boolean(
    user &&
      typeof user === "object" &&
      typeof (user as { id?: unknown }).id === "string" &&
      typeof (user as { nickname?: unknown }).nickname === "string" &&
      typeof (user as { avatarText?: unknown }).avatarText === "string"
  );
}

function isUserFollowUpdatedEvent(data: unknown): data is { followerUserId: string; followingUserId: string } {
  return Boolean(
    data &&
      typeof data === "object" &&
      typeof (data as { followerUserId?: unknown }).followerUserId === "string" &&
      typeof (data as { followingUserId?: unknown }).followingUserId === "string"
  );
}

