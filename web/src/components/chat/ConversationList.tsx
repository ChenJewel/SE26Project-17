import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  Bell,
  ChevronRight,
  Globe2,
  Heart,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Send,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CommunityPost } from "@/data/community";
import { mapConversation } from "@/hooks/useChatConversations";
import { useCapacitorBackButton } from "@/hooks/useCapacitorBackButton";
import { createGroupConversation, fetchPublicGroups, joinPublicGroup } from "@/services/chatApi";
import type { Conversation } from "@/types/chat";
import type { AppNotification, NotificationType } from "@/types/notification";
import { ChatAvatar } from "./ChatAvatar";
import { MessageSearch } from "./MessageSearch";
import { NotificationPanel, type NotificationPanelType } from "./NotificationPanel";

const groupCategories = ["饭友搭子", "聊天交友", "学习考试", "同城交流", "二次元", "游戏开黑"];

export function ConversationList({
  conversations,
  posts,
  notifications,
  unreadCounts,
  currentUserId,
  onOpenConversation,
  onOpenUser,
  onOpenPost,
  onMarkNotificationsRead,
  onChatChanged,
}: {
  conversations: Conversation[];
  posts: CommunityPost[];
  notifications: AppNotification[];
  unreadCounts: Record<NotificationType, number>;
  currentUserId?: string;
  onOpenConversation: (conversation: Conversation) => void;
  onOpenUser: (name: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
  onMarkNotificationsRead: (types: NotificationType[]) => void;
  onChatChanged: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [plazaOpen, setPlazaOpen] = useState(false);
  const [notificationPanel, setNotificationPanel] = useState<NotificationPanelType | null>(null);
  const visibleConversations = useMemo(
    () =>
      conversations
        .map((conversation, index) => ({ conversation, settings: readConversationLocalSettings(conversation.id), index }))
        .sort((left, right) => Number(right.settings.pinned) - Number(left.settings.pinned) || left.index - right.index),
    [conversations]
  );

  useCapacitorBackButton(() => {
    if (notificationPanel) {
      setNotificationPanel(null);
      return true;
    }
    if (searchOpen) {
      setSearchOpen(false);
      return true;
    }
    if (createOpen) {
      setCreateOpen(false);
      return true;
    }
    if (plazaOpen) {
      setPlazaOpen(false);
      return true;
    }
    if (plusOpen) {
      setPlusOpen(false);
      return true;
    }
    return false;
  }, Boolean(notificationPanel || searchOpen || createOpen || plazaOpen || plusOpen));

  return (
    <div className="app-shell min-h-[100dvh] bg-[#fbfdf9]">
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
            count={unreadCounts.like + unreadCounts.favorite}
            onClick={() => {
              setNotificationPanel("likes");
              onMarkNotificationsRead(["like", "favorite"]);
            }}
          />
          <NotifyTile
            icon={<UserPlus className="h-9 w-9 text-[#3478f6]" />}
            title="新增关注"
            bg="bg-[#eef5ff]"
            count={unreadCounts.follow}
            onClick={() => {
              setNotificationPanel("follows");
              onMarkNotificationsRead(["follow"]);
            }}
          />
          <NotifyTile
            icon={<AtSign className="h-9 w-9 text-[#20c77a]" />}
            title="评论和@"
            bg="bg-[#eafaf2]"
            count={unreadCounts.comment}
            onClick={() => {
              setNotificationPanel("comments");
              onMarkNotificationsRead(["comment"]);
            }}
          />
        </div>

        <div className="space-y-1">
          {visibleConversations.map(({ conversation: item, settings }) => (
            <button key={item.id} onClick={() => onOpenConversation(item)} className="flex w-full items-center gap-4 rounded-lg px-1 py-3 text-left transition hover:bg-[rgba(209,228,221,0.28)]">
              <span className="relative shrink-0">
                <ChatAvatar text={item.avatar} group={item.group} />
                {!item.group ? (
                  <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${item.online ? "bg-[#20c77a]" : "bg-[#c8c8c8]"}`} />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[19px] font-semibold text-[#252525]">{settings.remark || settings.groupRemark || item.name}</p>
                  {item.verified && <BadgeCheck className="h-4 w-4 fill-[var(--moss)] text-white" />}
                  {settings.pinned ? <span className="rounded-md bg-[rgba(209,228,221,0.72)] px-1.5 py-0.5 text-[10px] font-black text-[var(--pine)]">置顶</span> : null}
                  {settings.muted ? <Bell className="h-3.5 w-3.5 text-[#9a9a9a]" /> : null}
                  {item.group ? <span className="rounded-md bg-[rgba(209,228,221,0.72)] px-1.5 py-0.5 text-[10px] font-black text-[var(--pine)]">{item.memberCount ?? 1}人</span> : null}
                </div>
                <p className="mt-1 truncate text-[15px] font-semibold text-[#9a9a9a]">
                  {settings.blocked ? "已加入黑名单" : `${item.group ? `${item.category ?? "群聊"} · ` : `${item.online ? "在线" : "离线"} · `}${item.preview}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-sm font-semibold text-[#9a9a9a]">{item.time}</span>
                {item.unread > 0 && !settings.muted ? <span className="h-2.5 w-2.5 rounded-full bg-[#ff2442]" /> : null}
              </div>
            </button>
          ))}
        </div>
      </main>

      {plusOpen ? (
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setPlusOpen(false)}>
          <div className="absolute right-5 top-20 w-[220px] overflow-hidden rounded-lg bg-white shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            <MenuAction
              icon={<UsersRound className="h-7 w-7" />}
              title="创建群聊"
              onClick={() => {
                setPlusOpen(false);
                setCreateOpen(true);
              }}
            />
            <MenuAction
              icon={<Globe2 className="h-7 w-7" />}
              title="群聊广场"
              last
              onClick={() => {
                setPlusOpen(false);
                setPlazaOpen(true);
              }}
            />
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <CreateGroupView
          currentUserId={currentUserId}
          onClose={() => setCreateOpen(false)}
          onCreated={(conversation) => {
            onChatChanged();
            setCreateOpen(false);
            onOpenConversation(conversation);
          }}
        />
      ) : null}

      {plazaOpen ? (
        <GroupPlazaView
          currentUserId={currentUserId}
          onClose={() => setPlazaOpen(false)}
          onCreate={() => {
            setPlazaOpen(false);
            setCreateOpen(true);
          }}
          onOpenGroup={(conversation) => {
            onChatChanged();
            setPlazaOpen(false);
            onOpenConversation(conversation);
          }}
        />
      ) : null}

      {searchOpen && <MessageSearch onClose={() => setSearchOpen(false)} />}
      {notificationPanel ? (
        <NotificationPanel
          type={notificationPanel}
          posts={posts}
          notifications={notifications}
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

function CreateGroupView({
  currentUserId,
  onClose,
  onCreated,
}: {
  currentUserId?: string;
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(groupCategories[0]);
  const [location, setLocation] = useState("");
  const [joinQuestion, setJoinQuestion] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canCreate = title.trim().length >= 2 && description.trim().length >= 6;

  const create = async () => {
    if (!canCreate || saving) {
      setError("群名称至少 2 个字，群介绍至少 6 个字。");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const conversation = await createGroupConversation({
        title: title.trim(),
        description: description.trim(),
        category,
        location: location.trim() || undefined,
        joinQuestion: joinQuestion.trim() || undefined,
        isPublic,
      });
      onCreated(mapConversation(conversation, currentUserId));
    } catch (err) {
      console.warn("Failed to create group.", err);
      setError("创建失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-[var(--page-bg)]">
      <section className="mx-auto flex h-full max-w-md flex-col px-4 pb-5 pt-4">
        <Header title="创建群聊" onBack={onClose} />
        <main className="min-h-0 flex-1 overflow-y-auto pt-3">
          <section className="rounded-lg bg-white/82 p-4 ring-1 ring-[var(--line-soft)]">
            <FieldLabel label="群名称" required count={`${title.length}/24`}>
              <input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 24))} className="h-12 w-full bg-transparent text-[17px] font-black outline-none placeholder:text-[var(--text-faint)]" placeholder="请输入群名称" />
            </FieldLabel>
          </section>

          <section className="mt-3 rounded-lg bg-white/82 p-4 ring-1 ring-[var(--line-soft)]">
            <FieldLabel label="群介绍" required count={`${description.length}/100`}>
              <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 100))} className="min-h-28 w-full resize-none bg-transparent text-[15px] font-semibold leading-6 outline-none placeholder:text-[var(--text-faint)]" placeholder="简单说说你想在群内讨论的话题，以及希望哪些人加入" />
            </FieldLabel>
          </section>

          <section className="mt-3 overflow-hidden rounded-lg bg-white/82 ring-1 ring-[var(--line-soft)]">
            <SelectRow label="群类型" value={category} />
            <div className="flex flex-wrap gap-2 border-b border-[var(--line-soft)] px-4 py-3">
              {groupCategories.map((item) => (
                <button key={item} onClick={() => setCategory(item)} className={`rounded-lg px-3 py-1.5 text-sm font-black ${category === item ? "bg-[var(--pine)] text-white" : "bg-[rgba(244,248,244,0.92)] text-[var(--text-muted)]"}`}>
                  {item}
                </button>
              ))}
            </div>
            <TextRow label="地点" value={location} placeholder="未选择，可填学校/城市/餐厅" onChange={setLocation} />
            <TextRow label="进群问题" value={joinQuestion} placeholder="无，可设置一句筛选问题" onChange={setJoinQuestion} />
            <ToggleLine label="在群聊广场展示群聊" enabled={isPublic} onToggle={() => setIsPublic((value) => !value)} />
          </section>
        </main>

        {error ? <p className="mb-2 rounded-lg bg-[rgba(217,154,136,0.16)] px-3 py-2 text-center text-xs font-black text-[var(--coral)]">{error}</p> : null}
        <button onClick={create} disabled={!canCreate || saving} className="h-12 rounded-full bg-[var(--pine)] text-sm font-black text-white shadow-[0_12px_26px_rgba(63,111,96,0.22)] disabled:opacity-45">
          {saving ? "创建中..." : "立即创建"}
        </button>
        <p className="mt-3 text-center text-xs font-semibold text-[var(--text-muted)]">为维护群内信息生态健康，请遵守群聊公约</p>
      </section>
    </div>
  );
}

function GroupPlazaView({
  currentUserId,
  onClose,
  onCreate,
  onOpenGroup,
}: {
  currentUserId?: string;
  onClose: () => void;
  onCreate: () => void;
  onOpenGroup: (conversation: Conversation) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(groupCategories[0]);
  const [groups, setGroups] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicGroups(query, category)
      .then((items) => {
        if (!cancelled) setGroups(items.map((item) => mapConversation(item, currentUserId)));
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to load public groups.", error);
          setGroups([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, currentUserId, query]);

  const join = async (group: Conversation) => {
    try {
      const conversation = group.joined ? group : mapConversation(await joinPublicGroup(group.id), currentUserId);
      onOpenGroup(conversation);
    } catch (error) {
      console.warn("Failed to join group.", error);
    }
  };

  const featuredGroups = groups.slice(0, 2);
  const recommendedGroups = groups.slice(2);

  return (
    <div className="fixed inset-0 z-[70] bg-[#f7faf5]">
      <section className="mx-auto flex h-full max-w-md flex-col px-4 pb-5 pt-4">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg text-[var(--pine)]" aria-label="返回消息">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/86 px-3 ring-1 ring-[var(--line-soft)]">
            <Search className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--text-faint)]" placeholder="搜索你想找的群聊" />
          </label>
          <button onClick={onCreate} className="flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-black text-[var(--pine)]">
            <Plus className="h-5 w-5" />
            创建
          </button>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto pb-3 pt-5">
          <h1 className="display-cn text-[28px] text-[var(--text-main)]">Hi 欢迎来到群聊广场</h1>
          <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">寻找你感兴趣的群聊：</p>

          <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
            {groupCategories.map((item) => (
              <button key={item} onClick={() => setCategory(item)} className={`h-9 shrink-0 rounded-full px-4 text-sm font-black ${category === item ? "bg-[var(--pine)] text-white" : "bg-white/82 text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]"}`}>
                {item}
              </button>
            ))}
          </div>

          {featuredGroups.length ? (
            <section className="mt-5">
              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                {featuredGroups.map((group) => (
                  <button key={group.id} onClick={() => join(group)} className="h-44 w-[220px] shrink-0 rounded-lg bg-[var(--pine)] p-4 text-left text-white shadow-[0_12px_26px_rgba(63,111,96,0.2)]">
                    <h2 className="line-clamp-1 text-xl font-black">{group.name}</h2>
                    <p className="mt-2 text-sm font-bold text-[#d8eade]">{group.memberCount ?? 1}人 · {group.category}</p>
                    <p className="mt-8 line-clamp-3 text-sm font-semibold leading-6 text-[#fffdf3]">{group.description || group.preview}</p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <h2 className="mb-3 px-1 font-black text-[var(--text-muted)]">推荐</h2>
            <div className="space-y-1">
              {recommendedGroups.map((group) => (
                <GroupListRow key={group.id} group={group} onJoin={() => join(group)} />
              ))}
              {!loading && !groups.length ? (
                <p className="rounded-lg bg-white/82 p-5 text-center text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
                  暂时没有公开群聊，先创建一个吧。
                </p>
              ) : null}
              {loading ? <p className="py-5 text-center text-sm font-black text-[var(--pine)]">加载中...</p> : null}
            </div>
          </section>
        </main>
      </section>
    </div>
  );
}

function GroupListRow({ group, onJoin }: { group: Conversation; onJoin: () => void }) {
  return (
    <button onClick={onJoin} className="flex w-full items-center gap-3 rounded-lg bg-white/72 px-2 py-3 text-left ring-1 ring-transparent hover:ring-[var(--line-soft)]">
      <ChatAvatar text={group.avatar} group />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-black text-[var(--text-main)]">{group.name}({group.memberCount ?? 1})</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-[rgba(209,228,221,0.72)] px-2 py-0.5 text-[11px] font-black text-[var(--pine)]">{group.category ?? "群聊"}</span>
          <span className="rounded-md bg-[rgba(244,248,244,0.92)] px-2 py-0.5 text-[11px] font-black text-[var(--text-muted)]">{group.location || "校园"}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm font-semibold text-[var(--text-muted)]">{group.description || group.preview}</p>
      </div>
      <Send className="h-4 w-4 shrink-0 text-[var(--pine)]" />
    </button>
  );
}

function NotifyTile({ icon, title, bg, count, onClick }: { icon: ReactNode; title: string; bg: string; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-3">
      <span className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-lg ${bg}`}>
        {icon}
        {count ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#ff2442] px-1.5 py-0.5 text-xs font-black text-white">{count > 99 ? "99+" : count}</span> : null}
      </span>
      <span className="text-[16px] font-black text-[#333]">{title}</span>
    </button>
  );
}

function MenuAction({ icon, title, last, onClick }: { icon: ReactNode; title: string; last?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-4 px-7 py-5 text-left ${last ? "" : "border-b border-black/5"}`}>
      {icon}
      <span className="text-[18px] font-black text-[#2b2b2b]">{title}</span>
    </button>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="relative flex h-14 items-center justify-center">
      <button onClick={onBack} className="absolute left-0 safe-tap flex items-center justify-center rounded-lg text-[var(--pine)]" aria-label="返回">
        <ArrowLeft className="h-6 w-6" />
      </button>
      <h1 className="display-cn text-[22px] text-[var(--text-main)]">{title}</h1>
    </header>
  );
}

function FieldLabel({ label, required, count, children }: { label: string; required?: boolean; count?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[17px] font-black text-[var(--text-main)]">
        <span>{label}{required ? <span className="text-[var(--coral)]">*</span> : null}</span>
        {count ? <span className="text-xs font-bold text-[var(--text-faint)]">{count}</span> : null}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

type ConversationLocalSettings = {
  remark: string;
  groupRemark: string;
  muted: boolean;
  pinned: boolean;
  blocked: boolean;
};

function readConversationLocalSettings(conversationId: string): ConversationLocalSettings {
  try {
    const raw = window.localStorage.getItem(`ueat-chat-settings-${conversationId}`);
    const parsed = raw ? JSON.parse(raw) as Partial<ConversationLocalSettings> : {};
    return {
      remark: typeof parsed.remark === "string" ? parsed.remark : "",
      groupRemark: typeof parsed.groupRemark === "string" ? parsed.groupRemark : "",
      muted: Boolean(parsed.muted),
      pinned: Boolean(parsed.pinned),
      blocked: Boolean(parsed.blocked),
    };
  } catch {
    return { remark: "", groupRemark: "", muted: false, pinned: false, blocked: false };
  }
}

function SelectRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-4 py-4">
      <span className="font-black text-[var(--text-main)]">{label}</span>
      <span className="flex items-center gap-1 text-sm font-bold text-[var(--text-muted)]">{value}<ChevronRight className="h-4 w-4" /></span>
    </div>
  );
}

function TextRow({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-3 border-b border-[var(--line-soft)] px-4 py-4">
      <span className="shrink-0 font-black text-[var(--text-main)]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-right text-sm font-bold outline-none placeholder:text-[var(--text-faint)]" />
      {label === "地点" ? <MapPin className="h-4 w-4 text-[var(--text-faint)]" /> : <LockKeyhole className="h-4 w-4 text-[var(--text-faint)]" />}
    </label>
  );
}

function ToggleLine({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-4 text-left">
      <span className="font-black text-[var(--text-main)]">{label}</span>
      <span className={`relative h-7 w-12 rounded-full p-1 ${enabled ? "bg-[var(--pine)]" : "bg-[rgba(159,174,166,0.34)]"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
