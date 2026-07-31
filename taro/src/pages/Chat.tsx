/**
 * 消息页与聊天详情页。
 *
 * 默认显示消息首页：通知入口、会话列表、搜索和右上角加号菜单。
 * 点击会话后进入模拟聊天详情；搜索浮层会筛关注用户、群聊和聊天记录。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  Camera,
  CheckCheck,
  CircleUserRound,
  Heart,
  Keyboard,
  Mic,
  MoreHorizontal,
  Phone,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  QrCode,
  Search,
  Send,
  Smile,
  Utensils,
  UserPlus,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import type { MealExchangeRequest } from "@/types/exchange";

type Conversation = {
  id: string;
  name: string;
  avatar: string;
  preview: string;
  time: string;
  unread: number;
  online?: boolean;
  verified?: boolean;
  group?: boolean;
};

type ChatItem =
  | { id: string; type: "message"; from: "me" | "them"; text: string; time: string; read?: boolean }
  | { id: string; type: "call"; from: "me" | "them"; title: string; subtitle: string; time: string; missed?: boolean }
  | { id: string; type: "divider"; text: string }
  | { id: string; type: "notice"; text: string };

const conversations: Conversation[] = [
  { id: "lin", name: "林同学", avatar: "林", preview: "可以呀，那我们 18:30 二食堂东门见。", time: "刚刚", unread: 1, online: true, verified: true },
  { id: "chen", name: "陈同学", avatar: "陈", preview: "我也想吃清淡一点，可以看看一楼窗口。", time: "18:02", unread: 0, online: true, verified: true },
  { id: "movie", name: "富万贯观影团 3 群", avatar: "影", preview: "[群主发言] 周末电影报名开始了。", time: "下午3:35", unread: 1, group: true },
  { id: "food", name: "上海特卖小灵通87群", avatar: "群", preview: "[9条] 小羽毛：人广附近新开甜品店。", time: "下午3:09", unread: 1, group: true },
  { id: "system", name: "系统消息", avatar: "U", preview: "你的社区帖子收到新的评论。", time: "上午11:39", unread: 1, verified: true },
];

const chatItems: ChatItem[] = [
  { id: "d-1", type: "divider", text: "昨天" },
  { id: "n-1", type: "notice", text: "消息和通话仅用于确认约饭信息。见面前请先确认时间、地点和公开场所。" },
  { id: "m-1", type: "message", from: "me", text: "今天 18:30 二食堂可以吗？我想吃清淡一点。", time: "4:37 PM", read: true },
  { id: "m-2", type: "message", from: "them", text: "可以呀，我刚好也在附近。", time: "4:37 PM" },
  { id: "m-3", type: "message", from: "them", text: "我也不太能吃辣。", time: "4:38 PM" },
  { id: "d-2", type: "divider", text: "今天" },
  { id: "c-1", type: "call", from: "me", title: "语音通话", subtitle: "32 秒", time: "9:00 AM" },
  { id: "c-2", type: "call", from: "them", title: "未接语音通话", subtitle: "点按回拨", time: "9:01 AM", missed: true },
  { id: "m-4", type: "message", from: "me", text: "那我们在二食堂东门见？靠窗的位置人少一点。", time: "9:03 AM", read: true },
  { id: "m-5", type: "message", from: "them", text: "好，我下课过去。", time: "9:14 AM" },
];

const recentSearches = [
  { name: "林同学", avatar: "林" },
  { name: "陈同学", avatar: "陈" },
  { name: "富万贯观影团", avatar: "影" },
  { name: "二食堂聊天记录", avatar: "记" },
];

function findInitialConversation(activeName: string) {
  return conversations.find((item) => item.name === activeName);
}

export default function Chat({
  activeName,
  exchangeRequests,
  autoOpenRequestId,
  listResetSignal,
  onExchangeRespond,
}: {
  activeName: string;
  exchangeRequests: MealExchangeRequest[];
  autoOpenRequestId: string | null;
  listResetSignal: number;
  onExchangeRespond: (requestId: string, status: "rejected" | "accepted") => void;
}) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);

  // App controls whether this page opens as a list or a deep-linked conversation.
  // This avoids using static mock data as navigation truth after the app grows.
  const autoOpenedRequestId = useRef<string | null>(null);
  const sortedConversations = useMemo(() => {
    const hinted = findInitialConversation(activeName);
    return [...conversations].sort((a, b) => {
      if (hinted && a.id === hinted.id) return -1;
      if (hinted && b.id === hinted.id) return 1;
      return b.unread - a.unread;
    });
  }, [activeName]);

  useEffect(() => {
    const hinted = findInitialConversation(activeName);
    if (hinted && autoOpenRequestId && autoOpenedRequestId.current !== autoOpenRequestId) {
      autoOpenedRequestId.current = autoOpenRequestId;
      setActiveConversation(hinted);
    }
  }, [activeName, autoOpenRequestId]);

  useEffect(() => {
    setActiveConversation(null);
  }, [listResetSignal]);

  if (activeConversation) {
    return (
      <ChatDetail
        conversation={activeConversation}
        exchangeRequests={exchangeRequests.filter((request) => request.targetName === activeConversation.name)}
        onExchangeRespond={onExchangeRespond}
        onBack={() => setActiveConversation(null)}
      />
    );
  }

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
          <NotifyTile icon={<Heart className="h-9 w-9 fill-[#ff5366] text-[#ff5366]" />} title="赞和收藏" bg="bg-[#fff0f2]" />
          <NotifyTile icon={<UserPlus className="h-9 w-9 text-[#3478f6]" />} title="新增关注" bg="bg-[#eef5ff]" />
          <NotifyTile icon={<AtSign className="h-9 w-9 text-[#20c77a]" />} title="评论和@" bg="bg-[#eafaf2]" />
        </div>

        <div className="space-y-1">
          {sortedConversations.map((item) => (
            <button key={item.id} onClick={() => setActiveConversation(item)} className="flex w-full items-center gap-4 rounded-lg px-1 py-3 text-left transition hover:bg-[rgba(209,228,221,0.28)]">
              <Avatar text={item.avatar} group={item.group} />
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
    </div>
  );
}

function NotifyTile({ icon, title, bg }: { icon: React.ReactNode; title: string; bg: string }) {
  return (
    <button className="flex flex-col items-center gap-3">
      <span className={`flex h-[72px] w-[72px] items-center justify-center rounded-[22px] ${bg}`}>{icon}</span>
      <span className="text-[16px] font-black text-[#333]">{title}</span>
    </button>
  );
}

function MessageSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();
  const followedUsers = conversations.filter((item) => !item.group && item.id !== "system");
  const groupChats = conversations.filter((item) => item.group);
  const chatRecords = [
    ...conversations.map((item) => ({
      id: `preview-${item.id}`,
      title: item.name,
      text: item.preview,
      time: item.time,
    })),
    ...chatItems
      .filter((item): item is Extract<ChatItem, { type: "message" | "call" }> => item.type === "message" || item.type === "call")
      .map((item) => ({
        id: `record-${item.id}`,
        title: item.type === "message" ? (item.from === "me" ? "我发送的消息" : "林同学的消息") : item.title,
        text: item.type === "message" ? item.text : item.subtitle,
        time: item.time,
      })),
  ];

  const match = (text: string) => !keyword || text.toLowerCase().includes(keyword);
  const matchedUsers = followedUsers.filter((item) => match(`${item.name} ${item.preview}`));
  const matchedGroups = groupChats.filter((item) => match(`${item.name} ${item.preview}`));
  const matchedRecords = chatRecords.filter((item) => match(`${item.title} ${item.text} ${item.time}`));
  const hasQuery = keyword.length > 0;

  return (
    <div className="fixed inset-0 z-[70] bg-white">
      <div className="mx-auto max-w-md px-5 pt-8">
        <div className="flex items-center gap-3">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-[#f4f4f4] px-4">
            <Search className="h-5 w-5 text-[#aaa]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-[#aaa]"
              placeholder="搜索联系人/群聊/聊天记录"
            />
          </label>
          <button onClick={onClose} className="text-[17px] font-semibold text-[#777]">取消</button>
        </div>

        <div className="mt-7 max-h-[calc(100dvh-104px)] overflow-y-auto pb-8">
          {!hasQuery ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold text-[#999]">最近搜过</p>
                <button className="text-[#999]"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-5">
                {recentSearches.map((item) => (
                  <button key={item.name} className="text-center">
                    <Avatar text={item.avatar} />
                    <p className="mt-2 line-clamp-2 text-[14px] font-semibold text-[#666]">{item.name}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <MessageSearchGroup title="关注用户" count={matchedUsers.length}>
                {matchedUsers.map((item) => (
                  <SearchResultRow key={item.id} avatar={item.avatar} title={item.name} subtitle={item.preview} />
                ))}
              </MessageSearchGroup>
              <MessageSearchGroup title="群聊" count={matchedGroups.length}>
                {matchedGroups.map((item) => (
                  <SearchResultRow key={item.id} avatar={item.avatar} title={item.name} subtitle={item.preview} group />
                ))}
              </MessageSearchGroup>
              <MessageSearchGroup title="聊天记录" count={matchedRecords.length}>
                {matchedRecords.slice(0, 8).map((item) => (
                  <SearchResultRow key={item.id} avatar="记" title={item.title} subtitle={`${item.text} · ${item.time}`} />
                ))}
              </MessageSearchGroup>
              {!matchedUsers.length && !matchedGroups.length && !matchedRecords.length && (
                <div className="pt-16 text-center">
                  <Search className="mx-auto h-8 w-8 text-[#c2c2c2]" />
                  <p className="mt-3 text-[16px] font-black text-[#333]">没有找到相关消息</p>
                  <p className="mt-1 text-[14px] font-semibold text-[#999]">可以换个关键词试试</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageSearchGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[14px] font-black text-[#222]">{title}</h2>
        <span className="text-[12px] font-semibold text-[#aaa]">{count} 条</span>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function SearchResultRow({ avatar, title, subtitle, group }: { avatar: string; title: string; subtitle: string; group?: boolean }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left transition hover:bg-[#f7f7f7]">
      <Avatar text={avatar} group={group} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-black text-[#2b2b2b]">{title}</span>
        <span className="mt-0.5 block truncate text-[14px] font-semibold text-[#999]">{subtitle}</span>
      </span>
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

function ChatDetail({
  conversation,
  exchangeRequests,
  onExchangeRespond,
  onBack,
}: {
  conversation: Conversation;
  exchangeRequests: MealExchangeRequest[];
  onExchangeRespond: (requestId: string, status: "rejected" | "accepted") => void;
  onBack: () => void;
}) {
  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#efece4] pb-[74px] text-[#17231f]">
      <div className="absolute inset-0 opacity-[0.38]">
        <div className="h-full w-full bg-[radial-gradient(circle_at_12%_16%,rgba(63,111,96,0.14)_0_2px,transparent_3px),radial-gradient(circle_at_82%_22%,rgba(213,182,111,0.18)_0_3px,transparent_4px),radial-gradient(circle_at_42%_72%,rgba(217,154,136,0.16)_0_2px,transparent_3px),linear-gradient(45deg,transparent_0_46%,rgba(63,111,96,0.08)_47%_48%,transparent_49%)] bg-[length:42px_42px,58px_58px,54px_54px,36px_36px]" />
      </div>

      <header className="relative z-20 border-b border-[rgba(115,95,70,0.12)] bg-[rgba(251,250,245,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-3">
          <button onClick={onBack} className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="返回消息列表">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <Avatar text={conversation.avatar} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[16px] font-black text-[#111b16]">{conversation.name}</h1>
              {conversation.online && <span className="h-2 w-2 rounded-full bg-[#62b27d]" />}
            </div>
            <p className="truncate text-[12px] font-semibold text-[rgba(23,35,31,0.56)]">校园认证 · 通常几分钟内回复</p>
          </div>
          <button className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="视频通话">
            <Video className="h-[21px] w-[21px]" />
          </button>
          <button className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="语音通话">
            <Phone className="h-[20px] w-[20px]" />
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex h-[calc(100dvh-148px)] max-w-md flex-col gap-2 overflow-y-auto px-3 py-4">
        {chatItems.map((item) => {
          if (item.type === "divider") {
            return <div key={item.id} className="my-1 flex justify-center"><span className="rounded-lg bg-white/86 px-4 py-1 text-[12px] font-black">{item.text}</span></div>;
          }
          if (item.type === "notice") {
            return <div key={item.id} className="mx-auto mb-2 max-w-[310px] rounded-lg bg-[#fff4dc] px-4 py-3 text-center text-[13px] font-semibold leading-5 text-[#4f4634] shadow-sm">{item.text}</div>;
          }
          if (item.type === "call") {
            const mine = item.from === "me";
            return (
              <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`flex min-w-[210px] max-w-[78%] items-center gap-3 rounded-lg px-3 py-2.5 shadow-sm ${mine ? "bg-[#d8ffd5]" : "bg-white"}`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${item.missed ? "bg-[#fff0f3] text-[#e64c6a]" : "bg-[rgba(63,111,96,0.1)] text-[var(--pine)]"}`}>
                    {item.missed ? <PhoneMissed className="h-5 w-5" /> : <PhoneOutgoing className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block text-[14px] font-black">{item.title}</span><span className="block text-[13px] font-semibold text-black/60">{item.subtitle}</span></span>
                  <span className="self-end text-[11px] font-semibold text-black/50">{item.time}</span>
                </div>
              </div>
            );
          }
          const mine = item.from === "me";
          return (
            <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-lg px-3 py-2 shadow-sm ${mine ? "rounded-br-sm bg-[#d8ffd5]" : "rounded-bl-sm bg-white"}`}>
                <p className="text-[15px] font-semibold leading-[1.45]">{item.text}</p>
                <div className={`mt-1 flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                  <span className="text-[11px] font-semibold text-black/50">{item.time}</span>
                  {mine && item.read && <CheckCheck className="h-3.5 w-3.5 text-[#4a8f7b]" />}
                </div>
              </div>
            </div>
          );
        })}
        {exchangeRequests.map((request) => (
          <MealExchangeBubble
            key={request.id}
            request={request}
            onRespond={(status) => onExchangeRespond(request.id, status)}
          />
        ))}
      </main>

      <footer className="fixed inset-x-0 bottom-[74px] z-30 bg-[rgba(239,236,228,0.86)] px-3 py-2 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button className="safe-tap flex items-center justify-center rounded-full text-[#2a3b34]" aria-label="键盘"><Keyboard className="h-5 w-5" /></button>
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 shadow-sm ring-1 ring-black/10">
            <Smile className="h-5 w-5 shrink-0 text-black/50" />
            <input className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-black/40" placeholder="输入消息" />
            <MoreHorizontal className="h-5 w-5 shrink-0 text-black/50" />
          </label>
          <button className="safe-tap flex items-center justify-center rounded-full text-[#2a3b34]" aria-label="拍照"><Camera className="h-5 w-5" /></button>
          <button className="safe-tap flex items-center justify-center rounded-full text-[#2a3b34]" aria-label="语音"><Mic className="h-5 w-5" /></button>
          <button className="safe-tap flex items-center justify-center rounded-full bg-[var(--pine)] text-white shadow-[0_8px_18px_rgba(63,111,96,0.24)]" aria-label="发送"><Send className="h-[18px] w-[18px]" /></button>
        </div>
      </footer>
    </div>
  );
}

function MealExchangeBubble({
  request,
  onRespond,
}: {
  request: MealExchangeRequest;
  onRespond: (status: "rejected" | "accepted") => void;
}) {
  return (
    <div className="my-2 flex justify-center">
      <section className="w-full max-w-[330px] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/10">
        <div className="bg-[rgba(209,228,221,0.72)] px-3 py-2 text-center text-xs font-black text-[var(--pine)]">
          系统已向对方发送你的约饭卡，等待对方选择
        </div>
        <div className="p-3">
          <div className="meal-card rounded-lg p-3">
            <div className="card-content flex items-center gap-2">
              <span className="display-cn flex h-10 w-10 items-center justify-center rounded-lg bg-white/18 text-lg text-[#fffdf3]">
                {request.ownCard.avatarText}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-[#fffdf3]">{request.ownCard.nickname}的约饭卡</p>
                <p className="truncate text-xs font-bold text-[#d8eade]">{request.ownCard.place} · {request.ownCard.time}</p>
              </div>
              <Utensils className="h-5 w-5 text-[#ffedb8]" />
            </div>
            <p className="card-content mt-3 line-clamp-2 text-sm font-black leading-5 text-[#fffdf3]">{request.ownCard.text}</p>
          </div>

          {request.status === "pending" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => onRespond("rejected")}
                className="h-10 rounded-lg bg-[#f4f1eb] text-sm font-black text-[#7c6b58]"
              >
                拒绝
                <span className="ml-1 text-xs font-semibold">不好意思下次哦</span>
              </button>
              <button
                onClick={() => onRespond("accepted")}
                className="h-10 rounded-lg bg-[var(--pine)] text-sm font-black text-white"
              >
                聊聊看
              </button>
            </div>
          ) : (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-center text-sm font-black ${
                request.status === "accepted"
                  ? "bg-[rgba(209,228,221,0.72)] text-[var(--pine)]"
                  : "bg-[#f4f1eb] text-[#7c6b58]"
              }`}
            >
              {request.status === "accepted"
                ? "双方都已确认，可以继续聊约饭细节"
                : "对方已婉拒，本次交换卡片结束"}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Avatar({ text, group }: { text: string; group?: boolean }) {
  return (
    <span className={`display-cn flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full text-xl text-[#28483f] ${group ? "bg-gradient-to-br from-[#fff7d7] via-[#d1e4dd] to-[#b7b0d8]" : "bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7]"}`}>
      {text}
    </span>
  );
}
