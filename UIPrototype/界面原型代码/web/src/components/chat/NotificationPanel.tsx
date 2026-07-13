import { X } from "lucide-react";
import type { CommunityComment, CommunityPost } from "@/data/community";
import type { UserSummary } from "@/types/user";
import { ChatAvatar } from "./ChatAvatar";

export type NotificationPanelType = "likes" | "follows" | "comments";

/**
 * 消息页通知面板。
 *
 * 当前为了原型演示，列表内容由 posts/comments/followedUsers 即时拼装。
 * 正式版应改为读取 `AppNotification[]`，模型见 `types/notification.ts`，
 * 然后按 targetType/targetId 跳转帖子、评论区或用户主页。
 */
export function NotificationPanel({
  type,
  posts,
  comments,
  followedUsers,
  onClose,
  onOpenUser,
  onOpenPost,
}: {
  type: NotificationPanelType;
  posts: CommunityPost[];
  comments: CommunityComment[];
  followedUsers: UserSummary[];
  onClose: () => void;
  onOpenUser: (name: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
}) {
  const myPosts = posts.filter((post) => post.author === "我");
  const targetPosts = myPosts.length ? myPosts : posts.slice(0, 4);
  const title = type === "likes" ? "赞和收藏" : type === "follows" ? "新增关注" : "评论和@";

  return (
    <div className="fixed inset-0 z-[72] flex items-end bg-black/24 px-3 pb-3">
      <section className="mx-auto flex max-h-[78dvh] w-full max-w-md flex-col rounded-lg bg-white p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">Notifications</p>
            <h2 className="display-cn text-[22px] text-[var(--text-main)]">{title}</h2>
          </div>
          <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-2">
          {type === "follows" ? (
            followedUsers.length ? (
              followedUsers.map((user) => (
                <button
                  key={user.name}
                  onClick={() => onOpenUser(user.name)}
                  className="flex w-full items-center gap-3 rounded-lg bg-[var(--surface-soft)] p-3 text-left ring-1 ring-[var(--line-soft)]"
                >
                  <ChatAvatar text={user.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-[var(--text-main)]">{user.name}</span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--text-muted)]">{user.source ?? "刚刚关注"}</span>
                  </span>
                  <span className="text-xs font-black text-[var(--pine)]">主页</span>
                </button>
              ))
            ) : (
              <EmptyNotice text="还没有新增关注，去搜索里关注几个同学试试。" />
            )
          ) : null}

          {type === "comments"
            ? comments.slice(0, 8).map((comment) => {
                const post = posts.find((item) => item.id === comment.postId);
                return (
                  <button
                    key={comment.id}
                    onClick={() => onOpenPost(comment.postId, true)}
                    className="flex w-full gap-3 rounded-lg bg-[var(--surface-soft)] p-3 text-left ring-1 ring-[var(--line-soft)]"
                  >
                    <ChatAvatar text={comment.avatar} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-[var(--text-main)]">{comment.author} 回复或 @ 了你</span>
                      <span className="mt-1 block line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{comment.text}</span>
                      <span className="mt-1 block truncate text-xs font-bold text-[var(--text-faint)]">
                        {post?.title ?? "相关帖子"} · {comment.time}
                      </span>
                    </span>
                  </button>
                );
              })
            : null}

          {type === "comments" && !comments.length ? <EmptyNotice text="还没有新的评论或 @。" /> : null}

          {type === "likes"
            ? targetPosts.map((post, index) => {
                const user = ["林同学", "陈同学", "许同学", "周同学"][index % 4];
                const avatar = user.slice(0, 1);
                return (
                  <button
                    key={`${post.id}-${index}`}
                    onClick={() => onOpenPost(post.id)}
                    className="flex w-full gap-3 rounded-lg bg-[var(--surface-soft)] p-3 text-left ring-1 ring-[var(--line-soft)]"
                  >
                    <ChatAvatar text={avatar} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-[var(--text-main)]">
                        {user}
                        {index % 2 ? " 收藏了你的帖子" : " 赞了你的帖子"}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{post.title}</span>
                    </span>
                  </button>
                );
              })
            : null}
        </div>
      </section>
    </div>
  );
}

function EmptyNotice({ text }: { text: string }) {
  return <div className="rounded-lg bg-[var(--surface-soft)] p-4 text-center text-sm font-semibold text-[var(--text-muted)]">{text}</div>;
}
