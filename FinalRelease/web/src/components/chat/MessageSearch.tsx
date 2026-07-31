import { useState } from "react";
import { Search, X } from "lucide-react";
import { chatItems, conversations, recentSearches, type ChatItem } from "@/data/chat";
import { ChatAvatar } from "./ChatAvatar";

export function MessageSearch({ onClose }: { onClose: () => void }) {
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
    <div className="app-screen-overlay fixed inset-0 z-[70] bg-white">
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
                    <ChatAvatar text={item.avatar} />
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
      <ChatAvatar text={avatar} group={group} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-black text-[#2b2b2b]">{title}</span>
        <span className="mt-0.5 block truncate text-[14px] font-semibold text-[#999]">{subtitle}</span>
      </span>
    </button>
  );
}
