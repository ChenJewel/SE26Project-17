import { AtSign, BadgeCheck, CircleUserRound, Heart, Plus, QrCode, Search, UserPlus, UsersRound } from "lucide-react";
import { useState } from "react";
import type { Conversation } from "@/data/chat";
import type { CommunityComment, CommunityPost } from "@/data/community";
import type { UserSummary } from "@/types/user";
import { ChatAvatar } from "./ChatAvatar";
import { MessageSearch } from "./MessageSearch";
import { NotificationPanel, type NotificationPanelType } from "./NotificationPanel";

/**
 * 消息首页列表。
 *
 * 通知数量当前由帖子/评论/关注本地数据推导；正式版应接 notification summary 接口。
 */
export function ConversationList({
  conversations,
  posts,
  comments,
  followedUsers,
  onOpenConversation,
  onOpenUser,
  onOpenPost,
}: {
  conversations: Conversation[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  followedUsers: UserSummary[];
  onOpenConversation: (conversation: Conversation) => void;
  onOpenUser: (name: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [notificationPanel, setNotificationPanel] = useState<NotificationPanelType | null>(null);

  return (
    <div className="app-shell min-h-screen bg-[#fbfdf9]">
      <header className="sticky top-0 z-30 bg-[rgba(251,253,249,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <div className="w-16" />
          <h1 className="display-cn text-[25px] text-[var(--text-main)]">消息</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setSearchOpen(true)} className="safe-tap flex items-center justify-center rounded-full text-[var(--text-main)]" aria-label="搜索消息">
              <Search className="h-7 w-7" />
            </button>
            <button onClick={() => setPlusOpen((value) => !value)} className="safe-tap flex items-center justify-center rounded-full text-[var(--text-main)]" aria-label="更多消息功能">
              <Plus className="h-7 w-7" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-4">
        <div className="grid grid-cols-3 gap-3 pb-6 pt-2">
          <NotifyTile
            icon={<Heart className="h-9 w-9 fill-[#ff5366] text-[#ff5366]" />}
            title="赞和收藏"
            bg="bg-[#fff0f2]"
            count={Math.max(3, posts.filter((post) => post.author === "我").length)}
            onClick={() => setNotificationPanel("likes")}
          />
          <NotifyTile
            icon={<UserPlus className="h-9 w-9 text-[#3478f6]" />}
            title="新增关注"
            bg="bg-[#eef5ff]"
            count={followedUsers.length}
            onClick={() => setNotificationPanel("follows")}
          />
          <NotifyTile
            icon={<AtSign className="h-9 w-9 text-[#20c77a]" />}
            title="评论和@"
            bg="bg-[#eafaf2]"
            count={Math.max(2, comments.filter((comment) => !comment.mine).length)}
            onClick={() => setNotificationPanel("comments")}
          />
        </div>

        <div className="space-y-1">
          {conversations.map((item) => (
            <button key={item.id} onClick={() => onOpenConversation(item)} className="flex w-full items-center gap-4 rounded-lg px-1 py-3 text-left transition hover:bg-[rgba(209,228,221,0.28)]">
              <ChatAvatar text={item.avatar} group={item.group} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[19px] font-semibold text-[#252525]">{item.name}</p>
                  {item.verified && <BadgeCheck className="h-4 w-4 fill-[var(--moss)] text-white" />}
                </div>
                <p className="mt-1 truncate text-[15px] font-semibold text-[#9a9a9a]">{item.preview}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-sm font-semibold text-[#9a9a9a]">{item.time}</span>
                {item.unread > 0 && <span className="h-2.5 w-2.5 rounded-full bg-[#ff2442]" />}
              </div>
            </button>
          ))}
        </div>
      </main>

      {plusOpen && (
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setPlusOpen(false)}>
          <div className="absolute right-5 top-20 w-[220px] overflow-hidden rounded-[22px] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            <MenuAction icon={<MessageCircleIcon />} title="创建群聊" />
            <MenuAction icon={<UsersRound className="h-7 w-7" />} title="群聊广场" />
            <MenuAction icon={<UserPlus className="h-7 w-7" />} title="添加好友" />
            <MenuAction icon={<CircleUserRound className="h-7 w-7" />} title="创建圈子" />
            <MenuAction icon={<QrCode className="h-7 w-7" />} title="扫一扫" last />
          </div>
        </div>
      )}

      {searchOpen && <MessageSearch onClose={() => setSearchOpen(false)} />}
      {notificationPanel ? (
        <NotificationPanel
          type={notificationPanel}
          posts={posts}
          comments={comments}
          followedUsers={followedUsers}
          onClose={() => setNotificationPanel(null)}
          onOpenUser={(name) => {
            setNotificationPanel(null);
            onOpenUser(name);
          }}
          onOpenPost={(postId, commentsOpen) => {
            setNotificationPanel(null);
            onOpenPost(postId, commentsOpen);
          }}
        />
      ) : null}
    </div>
  );
}

function NotifyTile({
  icon,
  title,
  bg,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  bg: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-3">
      <span className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-[22px] ${bg}`}>
        {icon}
        {count ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#ff2442] px-1.5 py-0.5 text-xs font-black text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
      <span className="text-[16px] font-black text-[#333]">{title}</span>
    </button>
  );
}

function MenuAction({ icon, title, last }: { icon: React.ReactNode; title: string; last?: boolean }) {
  return (
    <button className={`flex w-full items-center gap-4 px-7 py-5 text-left ${last ? "" : "border-b border-black/5"}`}>
      {icon}
      <span className="text-[18px] font-black text-[#2b2b2b]">{title}</span>
    </button>
  );
}

function MessageCircleIcon() {
  return (
    <span className="relative">
      <Plus className="absolute -right-2 -top-2 h-4 w-4" />
      <UsersRound className="h-7 w-7" />
    </span>
  );
}
