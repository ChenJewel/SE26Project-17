import { X } from "lucide-react";
import type { CommunityPost } from "@/data/community";
import type { AppNotification } from "@/types/notification";
import { ChatAvatar } from "./ChatAvatar";

export type NotificationPanelType = "likes" | "follows" | "comments";

/**
 * 消息页通知面板。
 *
 * 列表内容来自云端 notifications。
 * “新增关注”表示别人关注了我，不是我关注的人。
 */
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
  onOpenUser: (name: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
}) {
  const title = type === "likes" ? "赞和收藏" : type === "follows" ? "新增关注" : "评论和@";
  const visibleNotifications = notifications.filter((notification) => {
    if (type === "likes") return notification.type === "like" || notification.type === "favorite";
    if (type === "follows") return notification.type === "follow";
    return notification.type === "comment";
  });

  return (
    <div className="app-bottom-sheet fixed inset-0 z-[72] flex items-end bg-black/24 px-3">
      <section className="mx-auto flex max-h-[78dvh] w-full max-w-md flex-col rounded-lg bg-white p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">Notifications</p>
            <h2 className="display-cn text-[22px] text-[var(--text-main)]">{title}</h2>
          </div>
        <button data-sheet-dismiss onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(174,217,197,0.34)] text-[var(--moss)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-2">
          {type === "follows" ? (
            visibleNotifications.length ? (
              visibleNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => onOpenUser(notification.actorUserId ?? notification.targetId ?? "")}
                  className="flex w-full items-center gap-3 rounded-lg bg-[var(--surface-soft)] p-3 text-left ring-1 ring-[var(--line-soft)]"
                >
                  <ChatAvatar text={(notification.text || "关").slice(0, 1)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-[var(--text-main)]">{notification.text}</span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--text-muted)]">别人关注了你</span>
                  </span>
                  <span className="text-xs font-black text-[var(--pine)]">主页</span>
                </button>
              ))
            ) : (
              <EmptyNotice text="还没有别人关注你。" />
            )
          ) : null}

          {type === "comments"
            ? visibleNotifications.map((notification) => {
                const post = posts.find((item) => item.id === notification.targetId);
                return (
                  <button
                    key={notification.id}
                    onClick={() => notification.targetId && onOpenPost(notification.targetId, true)}
                    className="flex w-full gap-3 rounded-lg bg-[var(--surface-soft)] p-3 text-left ring-1 ring-[var(--line-soft)]"
                  >
                    <ChatAvatar text={(notification.text || "评").slice(0, 1)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-[var(--text-main)]">{notification.text}</span>
                      <span className="mt-1 block truncate text-xs font-bold text-[var(--text-faint)]">
                        {post?.title ?? "相关帖子"}
                      </span>
                    </span>
                  </button>
                );
              })
            : null}

          {type === "comments" && !visibleNotifications.length ? <EmptyNotice text="还没有新的评论或 @。" /> : null}

          {type === "likes"
            ? visibleNotifications.map((notification) => {
                const post = posts.find((item) => item.id === notification.targetId);
                return (
                  <button
                    key={notification.id}
                    onClick={() => notification.targetId && onOpenPost(notification.targetId)}
                    className="flex w-full gap-3 rounded-lg bg-[var(--surface-soft)] p-3 text-left ring-1 ring-[var(--line-soft)]"
                  >
                    <ChatAvatar text={(notification.text || "赞").slice(0, 1)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-[var(--text-main)]">{notification.text}</span>
                      <span className="mt-1 block line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{post?.title ?? "相关帖子"}</span>
                    </span>
                  </button>
                );
              })
            : null}
          {type === "likes" && !visibleNotifications.length ? <EmptyNotice text="还没有新的赞或收藏。" /> : null}
        </div>
      </section>
    </div>
  );
}

function EmptyNotice({ text }: { text: string }) {
  return <div className="rounded-lg bg-[var(--surface-soft)] p-4 text-center text-sm font-semibold text-[var(--text-muted)]">{text}</div>;
}
