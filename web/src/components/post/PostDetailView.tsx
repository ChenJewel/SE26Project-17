import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bookmark,
  Check,
  Download,
  Flag,
  Heart,
  Image,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Play,
  Send,
  Share2,
  Star,
  Trash2,
  ThumbsDown,
  Type,
  UserRound,
  Video,
  X,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import type { CommunityComment, CommunityInteractionState, CommunityMediaType, CommunityPost, CommunityTopic } from "@/data/community";
import { useCapacitorBackButton } from "@/hooks/useCapacitorBackButton";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { PostStatsRow } from "./PostStatsRow";
import { createDirectConversation, fetchChatConversations, sendChatMessage } from "@/services/chatApi";
import { reportContent } from "@/services/reportsApi";
import { fetchMyProfile } from "@/services/userApi";
import {
  type ExternalShareChannel,
  type SharePayload,
  type ShareTarget,
  buildCommentShareSnapshot,
  buildExternalShareText,
  buildPostShareSnapshot,
  buildQQFriendShareUrls,
  buildQzoneShareUrl,
  buildShareText,
  copyText,
  dedupeTargets,
  downloadUrl,
  getPostMediaUrls,
  getPostShareUrl,
  openExternalUrl,
  openSystemShare,
  projectMomentum,
  readStringList,
  rubberband,
} from "./detail/postDetailUtils";

type PostDetailViewProps = {
  post: CommunityPost;
  comments: CommunityComment[];
  commentsOpen?: boolean;
  videoFeedPosts?: CommunityPost[];
  variant?: "embedded" | "overlay";
  interactions?: CommunityInteractionState;
  commentDraft?: string;
  onCommentDraftChange?: (value: string) => void;
  onClose?: () => void;
  onOpenComments?: () => void;
  onCloseComments?: () => void;
  onVideoFeedPostChange?: (post: CommunityPost) => void;
  onLikePost?: () => void;
  onFavoritePost?: () => void;
  onSharePost?: () => void;
  onPublishComment?: (parentCommentId?: string) => void | Promise<void>;
  onLikeComment?: (commentId: string) => void;
  onFavoriteComment?: (commentId: string) => void;
  onReportComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void | Promise<void>;
  onOpenUser?: (name: string, userId?: string) => void;
  currentUserId?: string;
  currentUserRole?: string;
  managementActions?: ReactNode;
};

const tagClass: Record<CommunityTopic, string> = {
  餐厅: "bg-[rgba(255,247,215,0.9)] text-[#806636]",
  生活: "bg-[rgba(209,228,221,0.92)] text-[var(--pine)]",
  经验: "bg-[rgba(183,176,216,0.24)] text-[#625b98]",
};

export function PostDetailView({
  post,
  comments,
  commentsOpen = false,
  videoFeedPosts = [],
  variant = "embedded",
  interactions,
  commentDraft = "",
  onCommentDraftChange,
  onClose,
  onOpenComments,
  onCloseComments,
  onVideoFeedPostChange,
  onLikePost,
  onFavoritePost,
  onSharePost,
  onPublishComment,
  onLikeComment,
  onFavoriteComment,
  onReportComment,
  onDeleteComment,
  onOpenUser,
  currentUserId,
  currentUserRole,
  managementActions,
}: PostDetailViewProps) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [replyTarget, setReplyTarget] = useState<CommunityComment | null>(null);
  const [commentSending, setCommentSending] = useState(false);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const liked = Boolean(interactions?.likedPostIds.includes(post.id));
  const favorited = Boolean(interactions?.favoritePostIds.includes(post.id));
  const mediaUrls = useMemo(() => getPostMediaUrls(post), [post]);
  const isVideoOverlay = post.mediaType === "video" && variant === "overlay";

  useCapacitorBackButton(() => {
    if (sharePayload) {
      setSharePayload(null);
      setShareStatus("");
      return true;
    }

    if (commentsOpen) {
      onCloseComments?.();
      return true;
    }

    if (photoOpen) {
      setPhotoOpen(false);
      return true;
    }

    return false;
  }, Boolean(sharePayload || commentsOpen || photoOpen));

  useEffect(() => {
    setMediaIndex(0);
  }, [post.id]);

  const publishComment = async (parentCommentId?: string) => {
    if (commentSending || !commentDraft.trim()) return;

    try {
      setCommentSending(true);
      await onPublishComment?.(parentCommentId);
      setReplyTarget(null);
    } finally {
      setCommentSending(false);
    }
  };

  const body = (
    <ArticleBody
      post={post}
      comments={comments}
      interactions={interactions}
      commentDraft={commentDraft}
      replyTarget={replyTarget}
      commentSending={commentSending}
      mediaUrls={mediaUrls}
      mediaIndex={mediaIndex}
      embedded={variant === "embedded"}
      dark={isVideoOverlay}
      commentsOpen={commentsOpen}
      videoFeedPosts={videoFeedPosts}
      liked={liked}
      favorited={favorited}
      onClose={onClose}
      onOpenUser={onOpenUser}
      onOpenPhoto={(index) => {
        setMediaIndex(index);
        setPhotoOpen(true);
      }}
      onMediaIndexChange={setMediaIndex}
      onLikePost={onLikePost}
      onFavoritePost={onFavoritePost}
      onOpenComments={onOpenComments}
      onCloseComments={onCloseComments}
      onVideoFeedPostChange={onVideoFeedPostChange}
      onSharePost={() => setSharePayload({ type: "post", post })}
      onReplyComment={setReplyTarget}
      onShareComment={(comment) => setSharePayload({ type: "comment", post, comment })}
      onCommentDraftChange={onCommentDraftChange}
      onPublishComment={publishComment}
      onLikeComment={onLikeComment}
      onFavoriteComment={onFavoriteComment}
      onReportComment={onReportComment}
      onDeleteComment={onDeleteComment}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      managementActions={managementActions}
    />
  );

  if (variant === "embedded") {
    return (
      <article className="space-y-4">
        {body}
        {photoOpen ? <PhotoLightbox post={post} index={mediaIndex} onIndexChange={setMediaIndex} onClose={() => setPhotoOpen(false)} /> : null}
        {sharePayload ? (
          <ShareSheet
            payload={sharePayload}
            status={shareStatus}
            onClose={() => {
              setSharePayload(null);
              setShareStatus("");
            }}
            onShared={() => {
              if (sharePayload.type === "post") onSharePost?.();
              setShareStatus("已发送");
            }}
          />
        ) : null}
      </article>
    );
  }

  return (
    <div className={`app-screen-overlay fixed inset-0 z-[70] ${isVideoOverlay ? "bg-black" : "bg-[rgba(18,30,25,0.36)]"}`}>
      <div className={`app-screen-panel relative mx-auto h-full max-w-md overflow-hidden ${isVideoOverlay ? "bg-black text-white" : "bg-[var(--surface)] text-[var(--text-main)]"}`}>
        {body}
        {photoOpen ? <PhotoLightbox post={post} index={mediaIndex} onIndexChange={setMediaIndex} onClose={() => setPhotoOpen(false)} /> : null}
        {sharePayload ? (
          <ShareSheet
            payload={sharePayload}
            status={shareStatus}
            onClose={() => {
              setSharePayload(null);
              setShareStatus("");
            }}
            onShared={() => {
              if (sharePayload.type === "post") onSharePost?.();
              setShareStatus("已发送");
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function ArticleBody({
  post,
  comments,
  interactions,
  commentDraft,
  replyTarget,
  commentSending,
  mediaUrls,
  mediaIndex,
  embedded,
  dark,
  commentsOpen,
  videoFeedPosts,
  liked,
  favorited,
  onClose,
  onOpenUser,
  onOpenPhoto,
  onMediaIndexChange,
  onLikePost,
  onFavoritePost,
  onOpenComments,
  onCloseComments,
  onVideoFeedPostChange,
  onSharePost,
  onReplyComment,
  onShareComment,
  onCommentDraftChange,
  onPublishComment,
  onLikeComment,
  onFavoriteComment,
  onReportComment,
  onDeleteComment,
  currentUserId,
  currentUserRole,
  managementActions,
}: {
  post: CommunityPost;
  comments: CommunityComment[];
  interactions?: CommunityInteractionState;
  commentDraft: string;
  replyTarget: CommunityComment | null;
  commentSending: boolean;
  mediaUrls: string[];
  mediaIndex: number;
  embedded: boolean;
  dark: boolean;
  commentsOpen: boolean;
  videoFeedPosts: CommunityPost[];
  liked: boolean;
  favorited: boolean;
  onClose?: () => void;
  onOpenUser?: (name: string, userId?: string) => void;
  onOpenPhoto: (index: number) => void;
  onMediaIndexChange: (index: number) => void;
  onLikePost?: () => void;
  onFavoritePost?: () => void;
  onOpenComments?: () => void;
  onCloseComments?: () => void;
  onVideoFeedPostChange?: (post: CommunityPost) => void;
  onSharePost?: () => void;
  onReplyComment: (comment: CommunityComment | null) => void;
  onShareComment: (comment: CommunityComment) => void;
  onCommentDraftChange?: (value: string) => void;
  onPublishComment?: (parentCommentId?: string) => void | Promise<void>;
  onLikeComment?: (commentId: string) => void;
  onFavoriteComment?: (commentId: string) => void;
  onReportComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void | Promise<void>;
  currentUserId?: string;
  currentUserRole?: string;
  managementActions?: ReactNode;
}) {
  const activeMediaUrl = mediaUrls[mediaIndex] ?? post.mediaUrl;
  const swipeStartXRef = useRef<number | null>(null);
  const [videoDragY, setVideoDragY] = useState(0);
  const [videoDragging, setVideoDragging] = useState(false);
  const [videoViewportHeight, setVideoViewportHeight] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  const videoDragStartRef = useRef<{ x: number; y: number; offsetY: number; at: number; active: boolean } | null>(null);
  const videoDragHistoryRef = useRef<Array<{ y: number; at: number }>>([]);
  const videoFeedIndex = videoFeedPosts.findIndex((item) => item.id === post.id);
  const canSwipeVideo = dark && videoFeedPosts.length > 1 && videoFeedIndex >= 0;
  const previousVideoPost = canSwipeVideo ? videoFeedPosts[videoFeedIndex - 1] : undefined;
  const nextVideoPost = canSwipeVideo ? videoFeedPosts[videoFeedIndex + 1] : undefined;
  const settleVideoDrag = () => {
    videoDragStartRef.current = null;
    videoDragHistoryRef.current = [];
    setVideoDragging(false);
    setVideoDragY(0);
  };
  const switchVideoPost = (direction: 1 | -1) => {
    if (!canSwipeVideo) return false;
    const nextPost = videoFeedPosts[videoFeedIndex + direction];
    if (!nextPost) return false;
    setVideoDragging(false);
    setVideoDragY(direction > 0 ? -videoViewportHeight : videoViewportHeight);
    window.setTimeout(() => {
      onVideoFeedPostChange?.(nextPost);
      setVideoDragY(0);
    }, 120);
    return true;
  };
  useEffect(() => {
    if (!dark || typeof window === "undefined") return;
    const syncHeight = () => setVideoViewportHeight(window.innerHeight);
    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
  }, [dark]);
  const mediaCarousel = !dark && post.mediaType !== "text" ? (
    <div
      className={`relative overflow-hidden bg-white ${embedded ? "" : "-mx-4 -mt-4 mb-4"}`}
      onTouchStart={(event) => {
        swipeStartXRef.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (swipeStartXRef.current === null || mediaUrls.length <= 1) return;
        const deltaX = (event.changedTouches[0]?.clientX ?? swipeStartXRef.current) - swipeStartXRef.current;
        swipeStartXRef.current = null;
        if (Math.abs(deltaX) < 36) return;
        onMediaIndexChange(Math.min(mediaUrls.length - 1, Math.max(0, mediaIndex + (deltaX < 0 ? 1 : -1))));
      }}
    >
      <button onClick={embedded ? () => onOpenPhoto(mediaIndex) : undefined} className="block w-full overflow-hidden text-left" aria-label="打开媒体">
        <PostVisual tone={post.imageTone} topic={post.topic} mediaType={post.mediaType} mediaUrl={activeMediaUrl} posterUrl={post.mediaPosterUrl} compact />
      </button>
      {mediaUrls.length > 1 ? (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-black/46 px-2 py-1 text-xs font-black text-white backdrop-blur">
            {mediaIndex + 1}/{mediaUrls.length}
          </span>
          <MediaPager count={mediaUrls.length} activeIndex={mediaIndex} onChange={onMediaIndexChange} />
        </>
      ) : null}
    </div>
  ) : null;
  const shellClass = embedded
    ? "overflow-hidden rounded-lg bg-white/86 ring-1 ring-[var(--line-soft)]"
    : dark
      ? "relative flex h-full flex-col bg-black text-white"
      : "flex h-full flex-col bg-[var(--surface)]";

  if (dark) {
    return (
      <section
        className="relative h-full overflow-hidden bg-black text-white touch-none select-none"
        onPointerDown={(event) => {
          if (!canSwipeVideo || commentsOpen) return;
          const target = event.target as HTMLElement;
          if (target.closest("button,input,textarea,a,[data-video-no-swipe]")) return;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // The WebView may already own capture for media elements.
          }
          const at = performance.now();
          videoDragStartRef.current = { x: event.clientX, y: event.clientY, offsetY: videoDragY, at, active: false };
          videoDragHistoryRef.current = [{ y: event.clientY, at }];
        }}
        onPointerMove={(event) => {
          const start = videoDragStartRef.current;
          if (!start) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (!start.active) {
            if (Math.abs(dy) < 10) return;
            if (Math.abs(dx) > Math.abs(dy)) {
              settleVideoDrag();
              return;
            }
            start.active = true;
            setVideoDragging(true);
          }
          event.preventDefault();
          const raw = start.offsetY + dy;
          const atFirst = videoFeedIndex <= 0 && raw > 0;
          const atLast = videoFeedIndex >= videoFeedPosts.length - 1 && raw < 0;
          setVideoDragY(atFirst || atLast ? (raw > 0 ? rubberband(raw, 520) : -rubberband(Math.abs(raw), 520)) : raw);
          videoDragHistoryRef.current = [...videoDragHistoryRef.current.slice(-5), { y: event.clientY, at: performance.now() }];
        }}
        onPointerUp={(event) => {
          if (!videoDragStartRef.current) return;
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            // Capture can be released by the browser during native media gestures.
          }
          if (!videoDragStartRef.current.active) {
            settleVideoDrag();
            return;
          }
          const history = videoDragHistoryRef.current;
          const first = history[0];
          const last = history[history.length - 1];
          const velocity = first && last && last.at !== first.at ? ((last.y - first.y) / (last.at - first.at)) * 1000 : 0;
          const projected = videoDragY + projectMomentum(velocity);
          const direction = projected < -150 || velocity < -950 ? 1 : projected > 150 || velocity > 950 ? -1 : 0;
          videoDragStartRef.current = null;
          videoDragHistoryRef.current = [];
          if (direction && switchVideoPost(direction)) return;
          settleVideoDrag();
        }}
        onPointerCancel={settleVideoDrag}
      >
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          style={{
            transform: `translate3d(0, ${videoDragY}px, 0)`,
            transition: videoDragging ? "none" : "transform 360ms var(--spring-soft)",
            willChange: "transform",
          }}
        >
          <PostVisual tone={post.imageTone} topic={post.topic} mediaType="video" mediaUrl={post.mediaUrl} posterUrl={post.mediaPosterUrl} full />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.34)_0%,transparent_28%,transparent_58%,rgba(0,0,0,0.76)_100%)]" />
        </div>
        {previousVideoPost ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black"
            style={{ transform: `translate3d(0, ${videoDragY - videoViewportHeight}px, 0)`, transition: videoDragging ? "none" : "transform 360ms var(--spring-soft)" }}
          >
            <PostVisual tone={previousVideoPost.imageTone} topic={previousVideoPost.topic} mediaType="video" mediaUrl={previousVideoPost.mediaUrl} posterUrl={previousVideoPost.mediaPosterUrl} full />
          </div>
        ) : null}
        {nextVideoPost ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black"
            style={{ transform: `translate3d(0, ${videoDragY + videoViewportHeight}px, 0)`, transition: videoDragging ? "none" : "transform 360ms var(--spring-soft)" }}
          >
            <PostVisual tone={nextVideoPost.imageTone} topic={nextVideoPost.topic} mediaType="video" mediaUrl={nextVideoPost.mediaUrl} posterUrl={nextVideoPost.mediaPosterUrl} full />
          </div>
        ) : null}

        <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pb-3 pt-[calc(18px+env(safe-area-inset-top))]">
          <button onClick={onClose} className="safe-tap flex h-10 w-10 items-center justify-center rounded-full bg-black/16 text-white backdrop-blur-md" aria-label="Close video">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {managementActions}
            <button onClick={onSharePost} className="safe-tap flex h-10 w-10 items-center justify-center rounded-full bg-black/16 text-white backdrop-blur-md" aria-label="Share video">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="absolute bottom-[92px] left-0 right-0 z-10 px-4">
          <button onClick={() => onOpenUser?.(post.author, post.authorId)} className="mb-3 flex items-center gap-3 text-left">
            <UserAvatar text={post.avatar} imageUrl={post.avatarUrl} rounded="full" className="border border-white/65 text-white" />
            <span className="text-[17px] font-black text-white">{post.author}</span>
            {post.followed ? (
              <span className="rounded-full bg-[#ff315e] px-4 py-1.5 text-sm font-black text-white shadow-[0_10px_28px_rgba(255,49,94,0.28)]">
                Follow
              </span>
            ) : null}
          </button>
          <h2 className="text-[18px] font-black leading-tight text-white drop-shadow">{post.title}</h2>
          <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-6 text-white/88 drop-shadow">{post.text}</p>
        </div>

        <PostActionBar
          liked={liked}
          favorited={favorited}
          comments={post.comments}
          dark
          showShare={false}
          onLike={onLikePost}
          onFavorite={onFavoritePost}
          onComment={onOpenComments}
          onShare={onSharePost}
        />

        {commentsOpen ? (
          <VideoCommentSheet
            post={post}
            comments={comments}
            interactions={interactions}
            commentDraft={commentDraft}
            replyTarget={replyTarget}
            commentSending={commentSending}
            onClose={onCloseComments}
            onReplyComment={onReplyComment}
            onShareComment={onShareComment}
            onCommentDraftChange={onCommentDraftChange}
            onPublishComment={onPublishComment}
            onLikeComment={onLikeComment}
            onFavoriteComment={onFavoriteComment}
            onReportComment={onReportComment}
            onDeleteComment={onDeleteComment}
            onOpenUser={onOpenUser}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className={shellClass}>
      {dark ? (
        <div className="absolute inset-0">
          <PostVisual tone={post.imageTone} topic={post.topic} mediaType="video" mediaUrl={post.mediaUrl} posterUrl={post.mediaPosterUrl} full />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.24)_0%,transparent_30%,transparent_54%,rgba(0,0,0,0.72)_100%)]" />
        </div>
      ) : null}

      <header className={`${dark ? "relative z-10 border-white/10 bg-black/12 text-white" : "border-[var(--line-soft)]"} flex items-center justify-between border-b px-4 py-3`}>
        <button
          onClick={() => onOpenUser?.(post.author, post.authorId)}
          className="flex min-w-0 items-center gap-3 text-left"
          aria-label={`查看${post.author}主页`}
        >
          <UserAvatar text={post.avatar} imageUrl={post.avatarUrl} rounded="full" className={dark ? "border border-white/60 text-white" : ""} />
          <span className="min-w-0 flex-1">
            <span className={`block font-black ${dark ? "text-white" : "text-[var(--text-main)]"}`}>{post.author}</span>
            <span className={`mt-0.5 flex items-center gap-1 text-xs font-bold ${dark ? "text-white/70" : "text-[var(--text-muted)]"}`}>
              <MapPin className="h-3.5 w-3.5" />
              {post.place}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {post.followed ? (
            <span className={`rounded-md px-2 py-1 text-[11px] font-black ${dark ? "bg-white/14 text-white" : "bg-[rgba(209,228,221,0.86)] text-[var(--pine)]"}`}>
              已关注
            </span>
          ) : null}
          {managementActions}
          {onClose ? (
            <button onClick={onClose} className={`safe-tap flex items-center justify-center rounded-lg ${dark ? "bg-white/12 text-white" : "bg-[rgba(209,228,221,0.72)] text-[var(--pine)]"}`} aria-label="关闭帖子">
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </header>

      {embedded ? mediaCarousel : null}

      <main className={`${embedded ? "p-4" : dark ? "relative z-10 mt-auto max-h-[62%] overflow-y-auto px-4 pb-5 pt-20" : "min-h-0 flex-1 overflow-y-auto px-4 py-4"}`}>
        {!embedded ? mediaCarousel : null}
        <span className={`rounded-md px-2 py-1 text-[12px] font-black ${dark ? "bg-white/16 text-white" : tagClass[post.topic]}`}>{post.topic}</span>
        <h2 className={`mt-3 text-[22px] font-black leading-tight ${dark ? "text-white" : "text-[var(--text-main)]"}`}>{post.title}</h2>
        <p className={`mt-3 text-[15px] font-semibold leading-7 ${dark ? "text-white/86" : "text-[var(--text-muted)]"}`}>{post.text}</p>
        <div className="mt-4">
          <PostStatsRow post={post} />
        </div>
        <InlineCommentThread
          post={post}
          comments={comments}
          interactions={interactions}
          commentDraft={commentDraft}
          replyTarget={replyTarget}
          commentSending={commentSending}
          dark={dark}
          onReplyComment={onReplyComment}
          onShareComment={onShareComment}
          onCommentDraftChange={onCommentDraftChange}
          onPublishComment={onPublishComment}
          onLikeComment={onLikeComment}
          onFavoriteComment={onFavoriteComment}
          onReportComment={onReportComment}
          onDeleteComment={onDeleteComment}
          onOpenUser={onOpenUser}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </main>

      {(!embedded || onLikePost || onFavoritePost || onOpenComments || onSharePost) ? (
        <PostActionBar
          liked={liked}
          favorited={favorited}
          comments={post.comments}
          dark={dark}
          onLike={onLikePost}
          onFavorite={onFavoritePost}
          onComment={onOpenComments}
          onShare={onSharePost}
        />
      ) : null}
    </section>
  );
}

function VideoCommentSheet({
  post,
  comments,
  interactions,
  commentDraft,
  replyTarget,
  commentSending,
  onClose,
  onReplyComment,
  onShareComment,
  onCommentDraftChange,
  onPublishComment,
  onLikeComment,
  onFavoriteComment,
  onReportComment,
  onDeleteComment,
  onOpenUser,
  currentUserId,
  currentUserRole,
}: {
  post: CommunityPost;
  comments: CommunityComment[];
  interactions?: CommunityInteractionState;
  commentDraft: string;
  replyTarget: CommunityComment | null;
  commentSending: boolean;
  onClose?: () => void;
  onReplyComment: (comment: CommunityComment | null) => void;
  onShareComment: (comment: CommunityComment) => void;
  onCommentDraftChange?: (value: string) => void;
  onPublishComment?: (parentCommentId?: string) => void | Promise<void>;
  onLikeComment?: (commentId: string) => void;
  onFavoriteComment?: (commentId: string) => void;
  onReportComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void | Promise<void>;
  onOpenUser?: (name: string, userId?: string) => void;
  currentUserId?: string;
  currentUserRole?: string;
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; at: number } | null>(null);
  const dragHistoryRef = useRef<Array<{ y: number; at: number }>>([]);

  const settleOpen = () => {
    setDragging(false);
    setDragY(0);
  };

  return (
    <div className={`absolute inset-0 z-[86] flex items-end ${dragging ? "app-sheet-dragging" : ""}`} style={{ backgroundColor: `rgba(0,0,0,${Math.max(0.04, 0.18 - dragY / 1200)})` }}>
      <section
        className="max-h-[72vh] w-full overflow-hidden rounded-t-[26px] bg-[rgba(255,255,255,0.96)] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2 text-[var(--text-main)] shadow-[0_-28px_72px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
        style={{
          transform: `translate3d(0, ${dragY}px, 0) scale(${1 - Math.min(dragY / 2200, 0.018)})`,
          transition: dragging ? "none" : "transform 360ms var(--spring-soft)",
          willChange: "transform",
        }}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button,input,textarea,[data-comment-scroll]")) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          dragStartRef.current = { y: event.clientY - dragY, at: performance.now() };
          dragHistoryRef.current = [{ y: event.clientY, at: performance.now() }];
        }}
        onPointerMove={(event) => {
          if (!dragStartRef.current) return;
          const next = Math.max(0, event.clientY - dragStartRef.current.y);
          setDragY(next > 0 ? rubberband(next, 520) : 0);
          dragHistoryRef.current = [...dragHistoryRef.current.slice(-5), { y: event.clientY, at: performance.now() }];
        }}
        onPointerUp={() => {
          const history = dragHistoryRef.current;
          const first = history[0];
          const last = history[history.length - 1];
          const velocity = first && last && last.at !== first.at ? ((last.y - first.y) / (last.at - first.at)) * 1000 : 0;
          const projected = dragY + projectMomentum(velocity);
          dragStartRef.current = null;
          dragHistoryRef.current = [];
          if (projected > 150 || velocity > 900) {
            setDragging(false);
            setDragY(520);
            window.setTimeout(() => onClose?.(), 140);
            return;
          }
          settleOpen();
        }}
        onPointerCancel={settleOpen}
      >
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-black/14" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[19px] font-black text-[#1f2522]">共 {post.comments.toLocaleString()} 条评论</h2>
          <button onClick={onClose} className="safe-tap flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-[#2a302d]" aria-label="Close comments">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div data-comment-scroll className="max-h-[calc(72vh-92px)] overflow-y-auto pr-1">
          <InlineCommentThread
            post={post}
            comments={comments}
            interactions={interactions}
            commentDraft={commentDraft}
            replyTarget={replyTarget}
            commentSending={commentSending}
            dark={false}
            showHeader={false}
            className="mt-0"
            onReplyComment={onReplyComment}
            onShareComment={onShareComment}
            onCommentDraftChange={onCommentDraftChange}
            onPublishComment={onPublishComment}
            onLikeComment={onLikeComment}
            onFavoriteComment={onFavoriteComment}
            onReportComment={onReportComment}
            onDeleteComment={onDeleteComment}
            onOpenUser={onOpenUser}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        </div>
      </section>
    </div>
  );
}

function InlineCommentThread({
  post,
  comments,
  interactions,
  commentDraft,
  replyTarget,
  commentSending,
  dark,
  onReplyComment,
  onShareComment,
  onCommentDraftChange,
  onPublishComment,
  onLikeComment,
  onFavoriteComment,
  onReportComment,
  onDeleteComment,
  onOpenUser,
  currentUserId,
  currentUserRole,
  showHeader = true,
  className = "mt-6",
}: {
  post: CommunityPost;
  comments: CommunityComment[];
  interactions?: CommunityInteractionState;
  commentDraft: string;
  replyTarget: CommunityComment | null;
  commentSending: boolean;
  dark?: boolean;
  onReplyComment: (comment: CommunityComment | null) => void;
  onShareComment: (comment: CommunityComment) => void;
  onCommentDraftChange?: (value: string) => void;
  onPublishComment?: (parentCommentId?: string) => void | Promise<void>;
  onLikeComment?: (commentId: string) => void;
  onFavoriteComment?: (commentId: string) => void;
  onReportComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void | Promise<void>;
  onOpenUser?: (name: string, userId?: string) => void;
  currentUserId?: string;
  currentUserRole?: string;
  showHeader?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textClass = dark ? "text-white" : "text-[var(--text-main)]";
  const mutedClass = dark ? "text-white/62" : "text-[var(--text-faint)]";
  const panelClass = dark ? "bg-white/8 ring-white/10" : "bg-white/72 ring-[var(--line-soft)]";

  useEffect(() => {
    if (!replyTarget) return;
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [replyTarget]);

  return (
    <section className={className}>
      {showHeader ? (
        <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={`text-sm font-black ${textClass}`}>共 {post.comments.toLocaleString()} 条评论</h3>
        <span className={`shrink-0 text-xs font-bold ${mutedClass}`}>点按回复，长按转发</span>
        </div>
      ) : null}
      <div className="space-y-3">
        {comments.length ? (
          comments.map((comment) => {
            const liked = Boolean(interactions?.likedCommentIds.includes(comment.id));
            const favorited = Boolean(interactions?.favoriteCommentIds.includes(comment.id));
            const reported = Boolean(interactions?.reportedCommentIds.includes(comment.id));
            const canDelete = Boolean(onDeleteComment && (comment.authorId === currentUserId || currentUserRole === "admin"));
            return (
              <CommentRow
                key={comment.id}
                comment={comment}
                liked={liked}
                favorited={favorited}
                reported={reported}
                canDelete={canDelete}
                dark={dark}
                panelClass={panelClass}
                textClass={textClass}
                mutedClass={mutedClass}
                onReply={() => onReplyComment(comment)}
                onShare={() => onShareComment(comment)}
                onLike={() => onLikeComment?.(comment.id)}
                onFavorite={() => onFavoriteComment?.(comment.id)}
                onReport={() => onReportComment?.(comment.id)}
                onDelete={() => onDeleteComment?.(comment.id)}
                onOpenUser={() => onOpenUser?.(comment.author, comment.authorId)}
              />
            );
          })
        ) : (
          <p className={`rounded-lg px-3 py-4 text-center text-sm font-bold ring-1 ${panelClass} ${mutedClass}`}>暂时还没有评论。</p>
        )}
      </div>
      <div className={`sticky bottom-0 mt-4 rounded-lg p-2 ring-1 ${panelClass}`}>
        {replyTarget ? (
          <div className={`mb-2 flex items-center justify-between rounded-md px-2 py-1 text-xs font-black ${dark ? "bg-white/10 text-white/82" : "bg-[rgba(209,228,221,0.66)] text-[var(--pine)]"}`}>
            <span>回复 @{replyTarget.author}</span>
            <button onClick={() => onReplyComment(null)} aria-label="取消回复"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <label className={`flex h-10 min-w-0 flex-1 items-center rounded-full px-4 ${dark ? "bg-white/12" : "bg-[var(--surface-soft)]"}`}>
            <input
              ref={inputRef}
              value={commentDraft}
              onChange={(event) => onCommentDraftChange?.(event.target.value)}
              className={`min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none ${dark ? "text-white placeholder:text-white/45" : "text-[var(--text-main)] placeholder:text-[var(--text-faint)]"}`}
              placeholder={replyTarget ? `回复 @${replyTarget.author}` : "有话要说，快来评论"}
            />
          </label>
          <button
            onClick={() => onPublishComment?.(replyTarget?.id)}
            disabled={commentSending || !commentDraft.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pine)] text-white disabled:opacity-50"
            aria-label="发送评论"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function CommentRow({
  comment,
  liked,
  favorited,
  reported,
  canDelete,
  dark,
  panelClass,
  textClass,
  mutedClass,
  onReply,
  onShare,
  onLike,
  onFavorite,
  onReport,
  onDelete,
  onOpenUser,
}: {
  comment: CommunityComment;
  liked: boolean;
  favorited: boolean;
  reported: boolean;
  canDelete: boolean;
  dark?: boolean;
  panelClass: string;
  textClass: string;
  mutedClass: string;
  onReply: () => void;
  onShare: () => void;
  onLike: () => void;
  onFavorite: () => void;
  onReport: () => void;
  onDelete: () => void;
  onOpenUser: () => void;
}) {
  const longPressTimerRef = useRef<number | undefined>();
  const longPressedRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
  };

  return (
    <article
      onClick={() => {
        if (longPressedRef.current) {
          longPressedRef.current = false;
          clearLongPressTimer();
          return;
        }
        clearLongPressTimer();
        onReply();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        clearLongPressTimer();
        onShare();
      }}
      onPointerDown={() => {
        clearLongPressTimer();
        longPressedRef.current = false;
        longPressTimerRef.current = window.setTimeout(() => {
          longPressTimerRef.current = undefined;
          longPressedRef.current = true;
          onShare();
        }, 520);
      }}
      onPointerUp={clearLongPressTimer}
      onPointerCancel={clearLongPressTimer}
      onPointerLeave={clearLongPressTimer}
      className={`flex gap-3 rounded-lg p-2 ring-1 ${panelClass}`}
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          clearLongPressTimer();
          onOpenUser();
        }}
        className="shrink-0"
        aria-label={`查看${comment.author}主页`}
      >
        <UserAvatar text={comment.avatar} imageUrl={comment.avatarUrl} rounded="full" className={dark ? "border border-white/20" : ""} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-black ${mutedClass}`}>
          {comment.author}
          {comment.replyToAuthor ? <span className="ml-1 font-bold">回复 @{comment.replyToAuthor}</span> : null}
        </p>
        <p className={`mt-1 text-[14px] font-semibold leading-5 ${textClass}`}>{comment.text}</p>
        {canDelete ? (
          <button
            onClick={(event) => {
              event.stopPropagation();
              clearLongPressTimer();
              onDelete();
            }}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-black text-[var(--coral)]"
            aria-label="删除评论"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </button>
        ) : null}
        <div className={`mt-2 flex flex-wrap items-center gap-4 text-[12px] font-bold ${mutedClass}`}>
          <span>{comment.time}</span>
          <button onClick={(event) => { event.stopPropagation(); onLike(); }} className={liked ? "text-[#e94d68]" : ""}>喜欢 {comment.likes}</button>
          <button onClick={(event) => { event.stopPropagation(); onFavorite(); }} className={favorited ? "text-[#d19a30]" : ""}>收藏</button>
          <button onClick={(event) => { event.stopPropagation(); onReport(); }} className={reported ? "text-[#9a5140]" : ""}>{reported ? "已举报" : "举报"}</button>
        </div>
      </div>
    </article>
  );
}

function PostActionBar({
  liked,
  favorited,
  comments,
  dark,
  onLike,
  onFavorite,
  onComment,
  onShare,
  showShare = true,
}: {
  liked: boolean;
  favorited: boolean;
  comments: number;
  dark?: boolean;
  showShare?: boolean;
  onLike?: () => void;
  onFavorite?: () => void;
  onComment?: () => void;
  onShare?: () => void;
}) {
  const idleClass = dark ? "text-white/76" : "text-[var(--text-muted)]";
  return (
    <footer className={`${dark ? "absolute bottom-0 left-0 right-0 z-20 border-white/10 bg-black/64 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-xl" : "relative z-20 border-[var(--line-soft)] bg-white/82"} grid ${showShare ? "grid-cols-4" : "grid-cols-3"} gap-2 border-t px-4 py-3`}>
      <button onClick={onLike} className={`flex flex-col items-center gap-1 text-xs font-black ${liked ? "text-[#e94d68]" : idleClass}`}>
        <Heart className={liked ? "h-5 w-5 fill-current" : "h-5 w-5"} />
        喜欢
      </button>
      <button onClick={onFavorite} className={`flex flex-col items-center gap-1 text-xs font-black ${favorited ? "text-[#d19a30]" : idleClass}`}>
        <Bookmark className={favorited ? "h-5 w-5 fill-current" : "h-5 w-5"} />
        收藏
      </button>
      <button onClick={onComment} className={`flex flex-col items-center gap-1 text-xs font-black ${idleClass}`}>
        <MessageCircle className="h-5 w-5" />
        {comments}
      </button>
      {showShare ? (
        <button onClick={onShare} className={`flex flex-col items-center gap-1 text-xs font-black ${idleClass}`}>
          <Share2 className="h-5 w-5" />
        其他
      </button>
      ) : null}
    </footer>
  );
}

function PhotoLightbox({ post, index, onIndexChange, onClose }: { post: CommunityPost; index: number; onIndexChange: (index: number) => void; onClose: () => void }) {
  const mediaUrls = getPostMediaUrls(post);
  const activeUrl = mediaUrls[index] ?? post.mediaUrl;
  return (
    <div className="absolute inset-0 z-40 bg-black">
      <PostVisual tone={post.imageTone} topic={post.topic} mediaType={post.mediaType === "video" ? "video" : "photo"} mediaUrl={activeUrl} posterUrl={post.mediaPosterUrl} full />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,transparent_28%,transparent_66%,rgba(0,0,0,0.54)_100%)]" />
      <button onClick={onClose} className="absolute right-4 top-8 safe-tap flex items-center justify-center rounded-full bg-black/28 text-white" aria-label="关闭照片">
        <X className="h-5 w-5" />
      </button>
      <div className="absolute inset-x-0 bottom-8 px-4 text-white">
        <p className="text-sm font-black">{post.author}</p>
        <h2 className="mt-1 text-xl font-black leading-tight">{post.title}</h2>
        {mediaUrls.length > 1 ? <MediaPager count={mediaUrls.length} activeIndex={index} onChange={onIndexChange} lightbox /> : null}
      </div>
    </div>
  );
}

function ShareSheet({ payload, status, onClose, onShared }: { payload: SharePayload; status: string; onClose: () => void; onShared: () => void }) {
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<ShareTarget | null>(null);
  const [fullOpen, setFullOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [sendingId, setSendingId] = useState("");
  const [actionStatus, setActionStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyProfile(), fetchChatConversations()])
      .then(([profile, conversations]) => {
        if (cancelled) return;
        const followers = new Set(profile.followers.map((user) => user.userId));
        const mutuals = profile.followedUsers
          .filter((user) => followers.has(user.userId))
          .map((user) => ({ id: `user-${user.userId}`, label: user.name, avatar: user.avatar, userId: user.userId, meta: "好友" }));
        const recent = conversations.slice(0, 12).map((conversation) => ({
          id: `conv-${conversation.id}`,
          label: conversation.title,
          avatar: conversation.avatarText ?? conversation.title.slice(0, 1),
          conversationId: conversation.id,
          userId: conversation.otherUserId,
          meta: conversation.group ? `${conversation.memberCount ?? conversation.memberUserIds.length}人` : "最近聊天",
        }));
        setTargets(dedupeTargets([...recent, ...mutuals]));
      })
      .catch((error) => console.warn("Failed to load share targets.", error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(onClose, 700);
    return () => window.clearTimeout(timer);
  }, [onClose, status]);

  useEffect(() => {
    if (!actionStatus) return;
    const timer = window.setTimeout(() => setActionStatus(""), 1800);
    return () => window.clearTimeout(timer);
  }, [actionStatus]);

  const filteredTargets = targets.filter((target) => target.label.toLowerCase().includes(query.trim().toLowerCase()));
  const quickTargets = targets.slice(0, 5);
  const mediaUrls = getPostMediaUrls(payload.post);
  const canSaveMedia = mediaUrls.length > 0 && payload.post.mediaType !== "text";

  const selectTarget = (target: ShareTarget) => {
    setSelectedTarget(target);
    setFullOpen(false);
  };

  const sendShare = async () => {
    if (!selectedTarget || sendingId || status) return;

    try {
      setSendingId(selectedTarget.id);
      const conversationId =
        selectedTarget.conversationId ??
        (selectedTarget.userId ? (await createDirectConversation(selectedTarget.userId, selectedTarget.label)).id : "");
      if (!conversationId) return;
      await sendChatMessage({
        conversationId,
        type: "text",
        text: buildShareText(payload, note),
        metadata: {
          shareType: payload.type,
          postId: payload.post.id,
          commentId: payload.type === "comment" ? payload.comment.id : undefined,
          note: note.trim() || undefined,
          postSnapshot: buildPostShareSnapshot(payload.post),
          commentSnapshot: payload.type === "comment" ? buildCommentShareSnapshot(payload.comment, payload.post) : undefined,
        },
      });
      onShared();
    } catch (error) {
      console.warn("Forward share failed.", error);
    } finally {
      setSendingId("");
    }
  };

  const shareToChannel = async (channel: ExternalShareChannel) => {
    try {
      const shareUrl = getPostShareUrl(payload.post.id);
      const text = buildExternalShareText(payload, note, shareUrl);
      const copied = await copyText(text);

      if (channel === "qzone") {
        openExternalUrl(buildQzoneShareUrl(payload, shareUrl));
        setActionStatus(copied ? "已打开QQ空间，内容也已复制" : "已打开QQ空间分享页");
        return;
      }

      if (channel === "qq") {
        const qqShare = buildQQFriendShareUrls(payload, shareUrl);
        openExternalUrl(qqShare.appUrl, qqShare.webUrl);
        setActionStatus(copied ? "已尝试打开QQ，内容也已复制" : "已尝试打开QQ");
        return;
      }

      const opened = await openSystemShare({
        title: payload.post.title,
        text,
        url: shareUrl,
        dialogTitle: channel === "moments" ? "分享到朋友圈" : "分享到微信好友",
      });
      if (opened) {
        setActionStatus(channel === "moments" ? "已打开分享面板，可选择朋友圈" : "已打开分享面板，可选择微信");
        return;
      }

      openExternalUrl("weixin://");
      setActionStatus(copied ? "已复制内容，请粘贴到微信" : "请手动复制内容到微信");
    } catch (error) {
      console.warn("Share action failed.", error);
      setActionStatus("分享未完成，已尽量保留复制兜底");
    }
  };

  const saveMedia = () => {
    if (!canSaveMedia) return;
    mediaUrls.forEach((url, index) => downloadUrl(url, `${payload.post.id}-${index + 1}`));
    setActionStatus(payload.post.mediaType === "video" ? "视频已开始保存" : mediaUrls.length > 1 ? "图片已开始批量保存" : "图片已开始保存");
  };

  const dislikePost = () => {
    const key = "ueat-disliked-post-topics";
    const current = readStringList(key);
    window.localStorage.setItem(key, JSON.stringify(Array.from(new Set([...current, payload.post.topic]))));
    setActionStatus("后续将少展示这类帖子");
  };

  const reportPost = async () => {
    try {
      await reportContent({ targetType: "post", targetId: payload.post.id, reason: "分享面板举报" });
      setActionStatus("举报已提交");
    } catch (error) {
      console.warn("Report post failed.", error);
      setActionStatus("举报提交失败");
    }
  };

  if (fullOpen) {
    return (
      <div className="app-screen-panel absolute inset-0 z-[90] bg-[var(--surface)] px-4 pt-8 text-[var(--text-main)]">
        <div className="flex h-12 items-center justify-between">
          <button onClick={() => setFullOpen(false)} className="text-sm font-black text-[var(--pine)]">取消</button>
          <h2 className="text-lg font-black">分享至</h2>
          <span className="w-9" />
        </div>
        <label className="mt-3 flex h-11 items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-3 ring-1 ring-[var(--line-soft)]">
          <UserRound className="h-4 w-4 text-[var(--text-faint)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" placeholder="搜索好友或群聊" />
        </label>
        <div className="mt-5 divide-y divide-[var(--line-soft)]">
          {filteredTargets.map((target) => {
            const selected = selectedTarget?.id === target.id;
            return (
              <button key={target.id} onClick={() => selectTarget(target)} className="flex w-full items-center gap-3 py-3 text-left">
                <TargetAvatar target={target} selected={selected} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black">{target.label}</span>
                  <span className="text-xs font-bold text-[var(--text-faint)]">{target.meta}</span>
                </span>
                <span className={`rounded-md px-3 py-1.5 text-xs font-black ${selected ? "bg-[var(--pine)] text-white" : "bg-[var(--surface-soft)] text-[var(--text-muted)]"}`}>
                  {selected ? "已选" : "选择"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="app-bottom-sheet absolute inset-0 z-[90] flex items-end bg-black/42">
      <section className="w-full rounded-t-[24px] bg-[var(--surface)] px-4 pb-6 pt-3 text-[var(--text-main)] shadow-[0_-20px_50px_rgba(0,0,0,0.28)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--line-soft)]" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">分享至</h2>
          <button data-sheet-dismiss onClick={onClose} className="safe-tap flex items-center justify-center rounded-full bg-[var(--surface-soft)]" aria-label="关闭分享">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
          {quickTargets.map((target) => (
            <button key={target.id} onClick={() => selectTarget(target)} className="w-16 shrink-0 text-center">
              <TargetAvatar target={target} selected={selectedTarget?.id === target.id} className="mx-auto" />
              <span className="mt-1 block truncate text-xs font-black">{target.label}</span>
              <span className="block truncate text-[10px] font-bold text-[var(--text-faint)]">{target.meta}</span>
            </button>
          ))}
          <button onClick={() => setFullOpen(true)} className="w-16 shrink-0 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--pine)]">
              <MoreHorizontal className="h-6 w-6" />
            </span>
            <span className="mt-1 block text-xs font-black">查看更多</span>
          </button>
        </div>
        <ShareConfirmBox
          selectedTarget={selectedTarget}
          note={note}
          status={status || actionStatus}
          sending={Boolean(sendingId)}
          onNoteChange={setNote}
          onSend={sendShare}
        />
        <div className="grid grid-cols-5 gap-3 border-t border-[var(--line-soft)] pt-4">
          <ShareIcon icon={<Send />} label="私信好友" onClick={() => setFullOpen(true)} />
          <ShareIcon icon={<MessageCircle />} label="微信好友" onClick={() => shareToChannel("wechat")} />
          <ShareIcon icon={<Star />} label="朋友圈" onClick={() => shareToChannel("moments")} />
          <ShareIcon icon={<UserRound />} label="QQ好友" onClick={() => shareToChannel("qq")} />
          <ShareIcon icon={<Bookmark />} label="QQ空间" onClick={() => shareToChannel("qzone")} />
        </div>
        <div className="mt-4 grid grid-cols-5 gap-3 border-t border-[var(--line-soft)] pt-4">
          <ShareIcon icon={<Download />} label="保存" disabled={!canSaveMedia} onClick={saveMedia} />
          <ShareIcon icon={<ThumbsDown />} label="不喜欢" onClick={dislikePost} />
          <ShareIcon icon={<Flag />} label="举报" onClick={reportPost} />
        </div>
      </section>
    </div>
  );
}

function TargetAvatar({ target, selected, className = "" }: { target: ShareTarget; selected: boolean; className?: string }) {
  return (
    <span className={`relative block h-12 w-12 ${className}`}>
      <UserAvatar text={target.avatar} rounded="full" className="h-12 w-12" />
      {selected ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ff3159] text-white ring-2 ring-[var(--surface)]">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      ) : null}
    </span>
  );
}

function ShareConfirmBox({
  selectedTarget,
  note,
  status,
  sending,
  onNoteChange,
  onSend,
}: {
  selectedTarget: ShareTarget | null;
  note: string;
  status: string;
  sending: boolean;
  onNoteChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <section className="mb-4 border-t border-[var(--line-soft)] pt-4">
      {selectedTarget ? (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-[var(--surface-soft)] px-3 py-2 ring-1 ring-[var(--line-soft)]">
          <TargetAvatar target={selectedTarget} selected />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black">发送给 {selectedTarget.label}</span>
            <span className="text-xs font-bold text-[var(--text-faint)]">{selectedTarget.meta}</span>
          </span>
        </div>
      ) : null}
      <textarea
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        className="min-h-28 w-full resize-none rounded-lg bg-[var(--surface-soft)] px-4 py-3 text-sm font-bold leading-6 text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--moss)]"
        placeholder="跟朋友说点什么吧..."
      />
      {status ? <p className="mt-2 rounded-lg bg-[rgba(209,228,221,0.62)] px-3 py-2 text-center text-xs font-black text-[var(--pine)]">{status}</p> : null}
      <button
        onClick={onSend}
        disabled={!selectedTarget || sending}
        className={`mt-3 h-12 w-full rounded-full text-base font-black transition ${
          selectedTarget && !sending
            ? "bg-[#ff3159] text-white shadow-[0_12px_26px_rgba(255,49,89,0.22)]"
            : "bg-[rgba(180,207,194,0.5)] text-[rgba(102,121,112,0.72)]"
        }`}
      >
        {sending ? "发送中..." : "发送"}
      </button>
    </section>
  );
}

function ShareIcon({ icon, label, disabled, onClick }: { icon: ReactNode; label: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className="min-w-0 text-center disabled:cursor-not-allowed disabled:opacity-40">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--pine)] ring-1 ring-[var(--line-soft)] [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <span className="mt-1 block truncate text-[11px] font-black text-[var(--text-muted)]">{label}</span>
    </button>
  );
}

function MediaPager({ count, activeIndex, lightbox, onChange }: { count: number; activeIndex: number; lightbox?: boolean; onChange: (index: number) => void }) {
  return (
    <div className={`${lightbox ? "mt-4" : "absolute inset-x-0 bottom-3"} flex items-center justify-center gap-1.5`}>
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          onClick={() => onChange(index)}
          className={`h-1.5 rounded-full transition ${index === activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/58"}`}
          aria-label={`查看第 ${index + 1} 张图`}
        />
      ))}
    </div>
  );
}

function PostVisual({
  tone,
  topic,
  mediaType,
  mediaUrl,
  posterUrl,
  compact,
  full,
}: {
  tone: CommunityPost["imageTone"];
  topic: CommunityTopic;
  mediaType: CommunityMediaType;
  mediaUrl?: string;
  posterUrl?: string;
  compact?: boolean;
  full?: boolean;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const resolvedPosterUrl = posterUrl ? resolveMediaUrl(posterUrl) : "";

  useEffect(() => {
    setMediaFailed(false);
  }, [mediaUrl, resolvedPosterUrl]);

  const visualMap: Record<CommunityPost["imageTone"], string> = {
    window:
      "bg-[linear-gradient(135deg,#d8eee5_0%,#f7faf5_44%,#f0d486_100%)] before:bg-[linear-gradient(90deg,rgba(63,111,96,0.24)_1px,transparent_1px),linear-gradient(0deg,rgba(63,111,96,0.18)_1px,transparent_1px)]",
    table:
      "bg-[linear-gradient(135deg,#f0d486_0%,#fbfdf9_52%,#92b8a7_100%)] before:bg-[radial-gradient(circle_at_30%_36%,rgba(63,111,96,0.32)_0_13%,transparent_14%),radial-gradient(circle_at_70%_68%,rgba(217,154,136,0.38)_0_12%,transparent_13%)]",
    note:
      "bg-[linear-gradient(145deg,#fff7d7_0%,#fbfdf9_58%,#d1e4dd_100%)] before:bg-[repeating-linear-gradient(0deg,rgba(90,130,114,0.18)_0_1px,transparent_1px_18px)]",
    walk:
      "bg-[linear-gradient(145deg,#d1e4dd_0%,#8fb9c7_48%,#f7faf5_100%)] before:bg-[linear-gradient(120deg,transparent_0_38%,rgba(255,255,255,0.72)_39%_45%,transparent_46%)]",
    safety:
      "bg-[linear-gradient(145deg,#21352d_0%,#3f6f60_52%,#d99a88_100%)] before:bg-[radial-gradient(circle_at_78%_22%,rgba(255,247,215,0.9)_0_8%,transparent_9%),linear-gradient(0deg,rgba(255,255,255,0.16)_1px,transparent_1px)]",
    quiet:
      "bg-[linear-gradient(145deg,#b7b0d8_0%,#fbfdf9_48%,#d1e4dd_100%)] before:bg-[radial-gradient(circle_at_28%_34%,rgba(255,255,255,0.72)_0_16%,transparent_17%),radial-gradient(circle_at_72%_66%,rgba(63,111,96,0.22)_0_15%,transparent_16%)]",
    campus:
      "bg-[linear-gradient(145deg,#8fb9c7_0%,#f7faf5_48%,#d5b66f_100%)] before:bg-[radial-gradient(circle_at_32%_42%,rgba(63,111,96,0.24)_0_12%,transparent_13%),radial-gradient(circle_at_72%_35%,rgba(255,255,255,0.8)_0_14%,transparent_15%)]",
    mountain:
      "bg-[linear-gradient(180deg,#8da1bd_0%,#f3f6fb_32%,#c4a04f_62%,#2f2f24_100%)] before:bg-[linear-gradient(145deg,transparent_0_42%,rgba(255,255,255,0.72)_43%_52%,transparent_53%),linear-gradient(24deg,transparent_0_47%,rgba(63,111,96,0.32)_48%_58%,transparent_59%)]",
    road:
      "bg-[linear-gradient(180deg,#59656f_0%,#d7c399_45%,#4d5b55_100%)] before:bg-[linear-gradient(90deg,transparent_0_46%,rgba(255,255,255,0.7)_47%_49%,transparent_50%),linear-gradient(18deg,transparent_0_40%,rgba(240,212,134,0.52)_41%_58%,transparent_59%)]",
  };

  const heightClass = full ? "h-full" : compact ? "h-40" : tone === "note" || tone === "safety" ? "h-44" : tone === "table" ? "h-36" : "h-40";
  const mediaFrameClass = full ? "h-full w-full" : "aspect-[9/16] w-full";
  const mediaBackgroundClass = mediaType === "video" ? "bg-black" : "bg-white";

  if (mediaUrl && mediaType !== "text") {
    const displayUrl = mediaType === "video" && resolvedPosterUrl && !full ? resolvedPosterUrl : mediaUrl;
    return (
      <div className={`relative ${mediaFrameClass} overflow-hidden ${mediaBackgroundClass}`}>
        {mediaFailed ? (
          <MediaUnsupportedNotice />
        ) : mediaType === "video" && (full || !resolvedPosterUrl) ? (
          <video
            src={mediaUrl}
            poster={resolvedPosterUrl || undefined}
            className="h-full w-full object-contain"
            controls={full}
            muted={!full}
            playsInline
            autoPlay={full}
            loop={full}
            preload="metadata"
            onError={() => setMediaFailed(true)}
          />
        ) : (
          <img src={displayUrl} alt={topic} className="h-full w-full object-contain" loading="lazy" onError={() => setMediaFailed(true)} />
        )}
        {mediaType === "video" && !full ? (
          <span className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(0,0,0,0.34)] text-white backdrop-blur">
            <Play className="h-5 w-5 fill-current" />
          </span>
        ) : null}
        {!full ? <MediaBadge topic={topic} mediaType={mediaType} /> : null}
      </div>
    );
  }

  return (
    <div className={`relative ${heightClass} overflow-hidden ${visualMap[tone]} before:absolute before:inset-0 before:bg-[length:34px_34px]`}>
      {mediaType === "video" && (
        <span className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(0,0,0,0.34)] text-white backdrop-blur">
          <Play className="h-5 w-5 fill-current" />
        </span>
      )}
      <MediaBadge topic={topic} mediaType={mediaType} />
    </div>
  );
}

function MediaUnsupportedNotice() {
  return (
    <div className="flex h-full min-h-40 w-full flex-col items-center justify-center bg-[rgba(236,247,242,0.92)] px-4 text-center text-[var(--pine)]">
      <Video className="h-7 w-7 opacity-70" />
      <p className="mt-2 text-sm font-black">该设备暂不支持此格式</p>
      <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">请尝试更新系统或重新上传</p>
    </div>
  );
}

function MediaBadge({ topic, mediaType }: { topic: CommunityTopic; mediaType: CommunityMediaType }) {
  return (
    <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
      <span className="rounded-md bg-[rgba(251,253,249,0.78)] px-2 py-1 text-[11px] font-black text-[var(--text-main)] backdrop-blur">{topic}</span>
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(251,253,249,0.72)] text-[var(--pine)] backdrop-blur">
        {mediaType === "video" ? <Video className="h-4 w-4" /> : mediaType === "photo" ? <Image className="h-4 w-4" /> : <Type className="h-4 w-4" />}
      </span>
    </div>
  );
}
