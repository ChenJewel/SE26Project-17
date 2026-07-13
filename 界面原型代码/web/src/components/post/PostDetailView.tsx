import { useState, type ReactNode } from "react";
import { Bookmark, Heart, Image, MapPin, MessageCircle, Play, Send, Share2, Type, Video, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import type { CommunityComment, CommunityInteractionState, CommunityMediaType, CommunityPost, CommunityTopic } from "@/data/community";
import { PostStatsRow } from "./PostStatsRow";

type PostDetailViewProps = {
  post: CommunityPost;
  comments: CommunityComment[];
  commentsOpen?: boolean;
  variant?: "embedded" | "overlay";
  interactions?: CommunityInteractionState;
  commentDraft?: string;
  onCommentDraftChange?: (value: string) => void;
  onClose?: () => void;
  onOpenComments?: () => void;
  onCloseComments?: () => void;
  onLikePost?: () => void;
  onFavoritePost?: () => void;
  onPublishComment?: () => void;
  onLikeComment?: (commentId: string) => void;
  onFavoriteComment?: (commentId: string) => void;
  onReportComment?: (commentId: string) => void;
  onOpenUser?: (name: string) => void;
};

const tagClass: Record<CommunityTopic, string> = {
  餐厅: "bg-[rgba(255,247,215,0.9)] text-[#806636]",
  生活: "bg-[rgba(209,228,221,0.92)] text-[var(--pine)]",
  经验: "bg-[rgba(183,176,216,0.24)] text-[#625b98]",
};

/**
 * 统一帖子详情视图。
 *
 * 搜索、我的、消息通知和社区点开的帖子都应该使用这个组件。
 * `variant="embedded"` 用于已有浮层内部；`variant="overlay"` 用于社区自己的全屏详情。
 * TODO(media): 这里仍使用 CSS 视觉占位，正式版应接 image/video 资源模型。
 */
export function PostDetailView({
  post,
  comments,
  commentsOpen = false,
  variant = "embedded",
  interactions,
  commentDraft = "",
  onCommentDraftChange,
  onClose,
  onOpenComments,
  onCloseComments,
  onLikePost,
  onFavoritePost,
  onPublishComment,
  onLikeComment,
  onFavoriteComment,
  onReportComment,
  onOpenUser,
}: PostDetailViewProps) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const liked = Boolean(interactions?.likedPostIds.includes(post.id));
  const favorited = Boolean(interactions?.favoritePostIds.includes(post.id));
  const isVideo = post.mediaType === "video";

  const content = isVideo && variant === "overlay" ? (
    <VideoOverlayBody
      post={post}
      liked={liked}
      favorited={favorited}
      onClose={onClose}
      onOpenUser={onOpenUser}
      onLikePost={onLikePost}
      onFavoritePost={onFavoritePost}
      onOpenComments={onOpenComments}
    />
  ) : (
    <ArticleBody
      post={post}
      embedded={variant === "embedded"}
      liked={liked}
      favorited={favorited}
      onClose={onClose}
      onOpenUser={onOpenUser}
      onOpenPhoto={() => setPhotoOpen(true)}
      onLikePost={onLikePost}
      onFavoritePost={onFavoritePost}
      onOpenComments={onOpenComments}
    />
  );

  if (variant === "embedded") {
    return (
      <article className="space-y-4">
        {content}
        <InlineComments post={post} comments={comments} commentsOpen={commentsOpen} />
        {photoOpen ? <PhotoLightbox post={post} onClose={() => setPhotoOpen(false)} /> : null}
      </article>
    );
  }

  return (
    <div className={`fixed inset-0 z-[70] ${isVideo ? "bg-black" : "bg-[rgba(18,30,25,0.36)]"}`}>
      <div className={`relative mx-auto h-full max-w-md overflow-hidden ${isVideo ? "bg-black text-white" : "bg-[var(--surface)] text-[var(--text-main)]"}`}>
        {content}
        {commentsOpen ? (
          <CommentsSheet
            post={post}
            comments={comments}
            interactions={interactions}
            commentDraft={commentDraft}
            onCommentDraftChange={onCommentDraftChange}
            onClose={onCloseComments}
            onPublishComment={onPublishComment}
            onLikeComment={onLikeComment}
            onFavoriteComment={onFavoriteComment}
            onReportComment={onReportComment}
          />
        ) : null}
        {photoOpen ? <PhotoLightbox post={post} onClose={() => setPhotoOpen(false)} /> : null}
      </div>
    </div>
  );
}

function ArticleBody({
  post,
  embedded,
  liked,
  favorited,
  onClose,
  onOpenUser,
  onOpenPhoto,
  onLikePost,
  onFavoritePost,
  onOpenComments,
}: {
  post: CommunityPost;
  embedded: boolean;
  liked: boolean;
  favorited: boolean;
  onClose?: () => void;
  onOpenUser?: (name: string) => void;
  onOpenPhoto: () => void;
  onLikePost?: () => void;
  onFavoritePost?: () => void;
  onOpenComments?: () => void;
}) {
  return (
    <section className={embedded ? "overflow-hidden rounded-lg bg-white/86 ring-1 ring-[var(--line-soft)]" : "flex h-full flex-col"}>
      <header className="flex items-center justify-between border-b border-[var(--line-soft)] px-4 py-3">
        <button
          onClick={() => onOpenUser?.(post.author)}
          className="flex min-w-0 items-center gap-3 text-left"
          aria-label={`查看${post.author}主页`}
        >
          <UserAvatar text={post.avatar} />
          <span className="min-w-0 flex-1">
            <span className="block font-black text-[var(--text-main)]">{post.author}</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-[var(--text-muted)]">
              <MapPin className="h-3.5 w-3.5" />
              {post.place}
            </span>
          </span>
        </button>
        {onClose ? (
          <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]" aria-label="关闭帖子">
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </header>

      {post.mediaType !== "text" ? (
        <button onClick={post.mediaType === "photo" ? onOpenPhoto : undefined} className="block w-full overflow-hidden text-left" aria-label={post.mediaType === "photo" ? "查看照片大图" : "查看视频"}>
          <PostVisual tone={post.imageTone} topic={post.topic} mediaType={post.mediaType} compact />
        </button>
      ) : null}

      <main className={embedded ? "p-4" : "min-h-0 flex-1 overflow-y-auto px-4 py-4"}>
        <span className={`rounded-md px-2 py-1 text-[12px] font-black ${tagClass[post.topic]}`}>{post.topic}</span>
        <h2 className="mt-3 text-[22px] font-black leading-tight text-[var(--text-main)]">{post.title}</h2>
        <p className="mt-3 text-[15px] font-semibold leading-7 text-[var(--text-muted)]">{post.text}</p>
        <div className="mt-4">
          <PostStatsRow post={post} />
        </div>
      </main>

      {!embedded ? (
        <PostActionBar liked={liked} favorited={favorited} comments={post.comments} onLike={onLikePost} onFavorite={onFavoritePost} onComment={onOpenComments} />
      ) : null}
    </section>
  );
}

function VideoOverlayBody({
  post,
  liked,
  favorited,
  onClose,
  onOpenUser,
  onLikePost,
  onFavoritePost,
  onOpenComments,
}: {
  post: CommunityPost;
  liked: boolean;
  favorited: boolean;
  onClose?: () => void;
  onOpenUser?: (name: string) => void;
  onLikePost?: () => void;
  onFavoritePost?: () => void;
  onOpenComments?: () => void;
}) {
  return (
    <>
      <div className="absolute inset-0">
        <PostVisual tone={post.imageTone} topic={post.topic} mediaType="video" full />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.24)_0%,transparent_30%,transparent_54%,rgba(0,0,0,0.68)_100%)]" />
      </div>
      <header className="absolute inset-x-0 top-0 z-10 flex justify-end px-4 pt-8">
        <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-full bg-black/24 text-white" aria-label="关闭视频">
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="absolute right-3 top-[42%] z-10 flex flex-col items-center gap-5">
        <button onClick={() => onOpenUser?.(post.author)} aria-label={`查看${post.author}主页`}>
          <UserAvatar text={post.avatar} rounded="full" className="border border-white/70 text-white" />
        </button>
        <ActionButton active={liked} icon={<Heart className="h-7 w-7" />} label={post.likes} onClick={onLikePost} />
        <ActionButton active={favorited} icon={<Bookmark className="h-7 w-7" />} label={post.favorites} onClick={onFavoritePost} />
        <ActionButton icon={<MessageCircle className="h-7 w-7" />} label={String(post.comments)} onClick={onOpenComments} />
        <ActionButton icon={<Share2 className="h-7 w-7" />} label="其他" />
      </div>
      <section className="absolute inset-x-0 bottom-7 z-10 px-4 pb-8">
        <p className="text-[16px] font-black">{post.author}</p>
        <h2 className="mt-1 max-w-[290px] text-[20px] font-black leading-tight">{post.title}</h2>
        <p className="mt-2 max-w-[300px] text-[14px] font-semibold leading-5 text-white/88">{post.text}</p>
      </section>
    </>
  );
}

function InlineComments({ post, comments, commentsOpen }: { post: CommunityPost; comments: CommunityComment[]; commentsOpen?: boolean }) {
  return (
    <section className="rounded-lg bg-white/86 p-4 ring-1 ring-[var(--line-soft)]">
      <h3 className="mb-3 font-black text-[var(--text-main)]">{commentsOpen ? "评论区" : "热门评论"}</h3>
      <div className="space-y-4">
        {comments.length ? (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <UserAvatar text={comment.avatar} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--text-faint)]">{comment.author} · {comment.time}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-main)]">{comment.text}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-[var(--text-muted)]">暂时还没有评论。</p>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2 ring-1 ring-[var(--line-soft)]">
        <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" placeholder="写评论..." />
        <Send className="h-4 w-4 text-[var(--pine)]" />
      </div>
    </section>
  );
}

function PostActionBar({
  liked,
  favorited,
  comments,
  onLike,
  onFavorite,
  onComment,
}: {
  liked: boolean;
  favorited: boolean;
  comments: number;
  onLike?: () => void;
  onFavorite?: () => void;
  onComment?: () => void;
}) {
  return (
    <footer className="grid grid-cols-4 gap-2 border-t border-[var(--line-soft)] bg-white/82 px-4 py-3">
      <button onClick={onLike} className={`flex flex-col items-center gap-1 text-xs font-black ${liked ? "text-[#e94d68]" : "text-[var(--text-muted)]"}`}>
        <Heart className={liked ? "h-5 w-5 fill-current" : "h-5 w-5"} />
        喜欢
      </button>
      <button onClick={onFavorite} className={`flex flex-col items-center gap-1 text-xs font-black ${favorited ? "text-[#d19a30]" : "text-[var(--text-muted)]"}`}>
        <Bookmark className={favorited ? "h-5 w-5 fill-current" : "h-5 w-5"} />
        收藏
      </button>
      <button onClick={onComment} className="flex flex-col items-center gap-1 text-xs font-black text-[var(--text-muted)]">
        <MessageCircle className="h-5 w-5" />
        {comments}
      </button>
      <button className="flex flex-col items-center gap-1 text-xs font-black text-[var(--text-muted)]">
        <Share2 className="h-5 w-5" />
        其他
      </button>
    </footer>
  );
}

function CommentsSheet({
  post,
  comments,
  interactions,
  commentDraft,
  onCommentDraftChange,
  onClose,
  onPublishComment,
  onLikeComment,
  onFavoriteComment,
  onReportComment,
}: {
  post: CommunityPost;
  comments: CommunityComment[];
  interactions?: CommunityInteractionState;
  commentDraft: string;
  onCommentDraftChange?: (value: string) => void;
  onClose?: () => void;
  onPublishComment?: () => void;
  onLikeComment?: (commentId: string) => void;
  onFavoriteComment?: (commentId: string) => void;
  onReportComment?: (commentId: string) => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-[22px] bg-[#f8f6f3] text-[#151515] shadow-[0_-16px_40px_rgba(0,0,0,0.2)]">
      <div className="flex h-12 items-center justify-center border-b border-black/5">
        <p className="text-sm font-black">{post.comments.toLocaleString()} comments</p>
        <button onClick={onClose} className="absolute right-3 safe-tap flex items-center justify-center rounded-full" aria-label="关闭评论">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[410px] overflow-y-auto px-4 py-3">
        {comments.map((comment) => {
          const liked = Boolean(interactions?.likedCommentIds.includes(comment.id));
          const favorited = Boolean(interactions?.favoriteCommentIds.includes(comment.id));
          const reported = Boolean(interactions?.reportedCommentIds.includes(comment.id));
          return (
            <div key={comment.id} className="mb-5 flex gap-3">
              <UserAvatar text={comment.avatar} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-black/52">{comment.author}</p>
                <p className="mt-0.5 text-[15px] font-semibold leading-5">{comment.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px] font-semibold text-black/42">
                  <span>{comment.time}</span>
                  <button onClick={() => onLikeComment?.(comment.id)} className={liked ? "text-[#e94d68]" : ""}>喜欢</button>
                  <button onClick={() => onFavoriteComment?.(comment.id)} className={favorited ? "text-[#d19a30]" : ""}>收藏</button>
                  <button onClick={() => onReportComment?.(comment.id)} className={reported ? "text-[#9a5140]" : ""}>{reported ? "已举报" : "举报"}</button>
                </div>
              </div>
              <button onClick={() => onLikeComment?.(comment.id)} className={`flex shrink-0 items-center gap-1 text-[12px] font-semibold ${liked ? "text-[#e94d68]" : "text-black/45"}`}>
                <Heart className={liked ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                {comment.likes}
              </button>
            </div>
          );
        })}
      </div>
      <div className="border-t border-black/5 bg-white/80 px-3 py-2">
        <div className="mb-2 flex justify-between text-[22px]">😀 🥰 😂 😳 ☺️ 😅 🥺</div>
        <div className="flex items-center gap-2">
          <UserAvatar text="我" />
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-[#f0eef0] px-4">
            <input
              value={commentDraft}
              onChange={(event) => onCommentDraftChange?.(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-black/38"
              placeholder="Add comment..."
            />
          </label>
          <button onClick={onPublishComment} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pine)] text-white">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoLightbox({ post, onClose }: { post: CommunityPost; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 bg-black">
      <PostVisual tone={post.imageTone} topic={post.topic} mediaType="photo" full />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,transparent_28%,transparent_66%,rgba(0,0,0,0.54)_100%)]" />
      <button onClick={onClose} className="absolute right-4 top-8 safe-tap flex items-center justify-center rounded-full bg-black/28 text-white" aria-label="关闭照片">
        <X className="h-5 w-5" />
      </button>
      <div className="absolute inset-x-0 bottom-8 px-4 text-white">
        <p className="text-sm font-black">{post.author}</p>
        <h2 className="mt-1 text-xl font-black leading-tight">{post.title}</h2>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 text-center drop-shadow ${active ? "text-[#ff5c78]" : "text-white"}`}>
      <span className="[&>svg]:fill-current">{icon}</span>
      <span className="text-[12px] font-black">{label}</span>
    </button>
  );
}

function PostVisual({
  tone,
  topic,
  mediaType,
  compact,
  full,
}: {
  tone: CommunityPost["imageTone"];
  topic: CommunityTopic;
  mediaType: CommunityMediaType;
  compact?: boolean;
  full?: boolean;
}) {
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

  return (
    <div className={`relative ${heightClass} overflow-hidden ${visualMap[tone]} before:absolute before:inset-0 before:bg-[length:34px_34px]`}>
      {mediaType === "video" && (
        <span className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(0,0,0,0.34)] text-white backdrop-blur">
          <Play className="h-5 w-5 fill-current" />
        </span>
      )}
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
        <span className="rounded-md bg-[rgba(251,253,249,0.78)] px-2 py-1 text-[11px] font-black text-[var(--text-main)] backdrop-blur">{topic}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(251,253,249,0.72)] text-[var(--pine)] backdrop-blur">
          {mediaType === "video" ? <Video className="h-4 w-4" /> : mediaType === "photo" ? <Image className="h-4 w-4" /> : <Type className="h-4 w-4" />}
        </span>
      </div>
    </div>
  );
}
