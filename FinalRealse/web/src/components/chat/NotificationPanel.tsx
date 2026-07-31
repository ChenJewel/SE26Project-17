import { Bookmark, Heart, MessageCircle, Play, Star, X } from "lucide-react";
import type { CommunityPost } from "@/data/community";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { AppNotification } from "@/types/notification";
import { ChatAvatar } from "./ChatAvatar";

export type NotificationPanelType = "likes" | "follows" | "comments";

export function NotificationPanel({
  type,
  posts,
  notifications,
  onClose,
  onOpenUser,
  onOpenPost,
}: {
  type: NotificationPanelType;
  posts: CommunityPost[];
  notifications: AppNotification[];
  onClose: () => void;
  onOpenUser: (name: string, userId?: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
}) {
  const title = type === "likes" ? "赞和收藏" : type === "follows" ? "新增关注" : "评论和 @";
  const subtitle =
    type === "likes"
      ? "点赞笔记、收藏笔记、点赞评论和收藏评论"
      : type === "follows"
        ? "最近关注你的人"
        : "评论了你的笔记、回复了你的评论";
  const visibleNotifications = notifications.filter((notification) => {
    if (type === "likes") return notification.type === "like" || notification.type === "favorite";
    if (type === "follows") return notification.type === "follow";
    return notification.type === "comment";
  });

  return (
    <div className="app-bottom-sheet fixed inset-0 z-[72] flex items-end bg-black/24 px-3">
      <section className="mx-auto flex max-h-[82dvh] w-full max-w-md flex-col rounded-[28px] bg-white p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--pine)]">Notifications</p>
            <h2 className="display-cn text-[22px] text-[var(--text-main)]">{title}</h2>
            <p className="mt-0.5 text-xs font-semibold text-[var(--text-muted)]">{subtitle}</p>
          </div>
          <button
            data-sheet-dismiss
            onClick={onClose}
            className="safe-tap flex items-center justify-center rounded-full bg-[rgba(209,228,221,0.72)] text-[var(--pine)]"
            aria-label="关闭通知"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {visibleNotifications.length ? (
            visibleNotifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                posts={posts}
                panelType={type}
                onOpenUser={onOpenUser}
                onOpenPost={onOpenPost}
              />
            ))
          ) : (
            <EmptyNotice text={getEmptyText(type)} />
          )}
        </div>
      </section>
    </div>
  );
}

function NotificationRow({
  notification,
  posts,
  panelType,
  onOpenUser,
  onOpenPost,
}: {
  notification: AppNotification;
  posts: CommunityPost[];
  panelType: NotificationPanelType;
  onOpenUser: (name: string, userId?: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
}) {
  const actorName = notification.actor?.nickname ?? inferActorName(notification.text) ?? "对方";
  const actorText = notification.actor?.avatarText ?? actorName.slice(0, 1);
  const targetPost = resolveTargetPost(notification, posts);
  const postId = targetPost?.id ?? (notification.targetType === "post" ? notification.targetId : notification.targetComment?.postId);
  const summary = getNotificationSummary(notification, actorName);
  const shouldOpenComments = panelType === "comments" || notification.targetType === "comment";

  return (
    <article className="flex gap-3 rounded-[22px] bg-[var(--surface-soft)] p-3 text-left ring-1 ring-[var(--line-soft)]">
      <button
        onClick={() => onOpenUser(actorName, notification.actor?.id ?? notification.actorUserId)}
        className="shrink-0 rounded-full text-left"
        aria-label={`打开 ${actorName} 的主页`}
      >
        <ChatAvatar text={actorText} imageUrl={notification.actor?.avatarUrl} />
      </button>

      <button
        onClick={() => {
          if (postId) onOpenPost(postId, shouldOpenComments);
          else onOpenUser(actorName, notification.actor?.id ?? notification.actorUserId);
        }}
        className="min-w-0 flex flex-1 items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <NotificationIcon notification={notification} />
            <span className="truncate text-[13px] font-black text-[var(--text-main)]">{summary.title}</span>
          </span>
          {summary.primary ? (
            <span className="mt-1 block line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--text-main)]">{summary.primary}</span>
          ) : null}
          {summary.quote ? (
            <span className="mt-1 block rounded-[14px] bg-white/76 px-2 py-1 text-xs font-semibold leading-snug text-[var(--text-muted)]">
              {summary.quote}
            </span>
          ) : null}
          <span className="mt-1 block truncate text-[11px] font-bold text-[var(--text-faint)]">
            {targetPost?.title || targetPost?.text || "相关内容"}
          </span>
        </span>
        <PostThumbnail post={targetPost} />
      </button>
    </article>
  );
}

function NotificationIcon({ notification }: { notification: AppNotification }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (notification.type === "favorite") return <Bookmark className={`${className} text-[#d5a933]`} fill="currentColor" />;
  if (notification.type === "like") return <Heart className={`${className} text-[#d66a78]`} fill="currentColor" />;
  if (notification.type === "follow") return <Star className={`${className} text-[#d5a933]`} fill="currentColor" />;
  return <MessageCircle className={`${className} text-[var(--pine)]`} />;
}

function PostThumbnail({ post }: { post?: AppNotification["targetPost"] | CommunityPost }) {
  const mediaUrl = post?.mediaPosterUrl || post?.mediaUrls?.[0] || post?.mediaUrl || "";
  const resolvedMediaUrl = resolveMediaUrl(mediaUrl);

  if (!post) {
    return <span className="h-[70px] w-[58px] shrink-0 rounded-[16px] bg-white/70 ring-1 ring-[var(--line-soft)]" />;
  }

  if (resolvedMediaUrl && post.mediaType === "video") {
    return (
      <span className="relative h-[70px] w-[58px] shrink-0 overflow-hidden rounded-[16px] bg-[#f7f3e8] ring-1 ring-[var(--line-soft)]">
        <video src={resolveMediaUrl(post.mediaUrls?.[0] || post.mediaUrl)} poster={resolveMediaUrl(post.mediaPosterUrl)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 text-white">
          <Play className="h-5 w-5" fill="currentColor" />
        </span>
      </span>
    );
  }

  if (resolvedMediaUrl) {
    return (
      <span className="h-[70px] w-[58px] shrink-0 overflow-hidden rounded-[16px] bg-[#f7f3e8] ring-1 ring-[var(--line-soft)]">
        <img src={resolvedMediaUrl} alt={post.title || "通知相关图片"} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span className="flex h-[70px] w-[58px] shrink-0 items-center justify-center rounded-[16px] bg-white/76 px-2 text-center text-[10px] font-black leading-tight text-[var(--pine)] ring-1 ring-[var(--line-soft)]">
      {post.title || "笔记"}
    </span>
  );
}

function getNotificationSummary(notification: AppNotification, actorName: string) {
  if (notification.type === "follow") {
    return { title: `${actorName} 关注了你`, primary: "", quote: "" };
  }

  if (notification.type === "comment") {
    const commentText = notification.targetComment?.text ?? "";
    if (notification.text.includes("提到了你")) {
      return {
        title: `${actorName} 提到了你`,
        primary: commentText || notification.text,
        quote: "",
      };
    }
    if (notification.parentComment) {
      return {
        title: `${actorName} 回复了你的评论`,
        primary: commentText,
        quote: `你的评论：${notification.parentComment.text}`,
      };
    }
    return {
      title: `${actorName} 评论了你的笔记`,
      primary: commentText || notification.text,
      quote: "",
    };
  }

  const verb = notification.type === "favorite" ? "收藏了" : "赞了";
  if (notification.targetComment) {
    return {
      title: `${actorName} ${verb}你的评论`,
      primary: notification.targetComment.text,
      quote: "",
    };
  }

  return {
    title: `${actorName} ${verb}你的笔记`,
    primary: notification.targetPost?.title || notification.targetPost?.text || "",
    quote: "",
  };
}

function resolveTargetPost(notification: AppNotification, posts: CommunityPost[]) {
  if (notification.targetPost) return notification.targetPost;
  if (notification.targetType === "post" && notification.targetId) return posts.find((post) => post.id === notification.targetId);
  if (notification.targetComment?.postId) return posts.find((post) => post.id === notification.targetComment?.postId);
  return undefined;
}

function inferActorName(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

function getEmptyText(type: NotificationPanelType) {
  if (type === "likes") return "还没有新的赞或收藏。";
  if (type === "follows") return "还没有别人关注你。";
  return "还没有新的评论或 @。";
}

function EmptyNotice({ text }: { text: string }) {
  return <div className="rounded-[22px] bg-[var(--surface-soft)] p-4 text-center text-sm font-semibold text-[var(--text-muted)]">{text}</div>;
}
