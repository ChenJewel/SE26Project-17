import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BadgeCheck, Heart, MapPin, MessageCircle, Search, Sparkles, UserRound, Utensils, X } from "lucide-react";
import type { MealCard } from "@/pages/CreateCard";
import type { CommunityPost } from "@/data/community";

interface SearchOverlayProps {
  open: boolean;
  cards: MealCard[];
  posts: CommunityPost[];
  onClose: () => void;
}

type SearchSection = "全部" | "用户" | "约饭卡片" | "帖子";

const sections: SearchSection[] = ["全部", "用户", "约饭卡片", "帖子"];

export default function SearchOverlay({ open, cards, posts, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<SearchSection>("全部");

  const keyword = query.trim().toLowerCase();

  const users = useMemo(() => {
    const userMap = new Map<string, { name: string; avatar: string; source: string; verified?: boolean }>();

    cards.forEach((card) => {
      userMap.set(card.nickname, {
        name: card.nickname,
        avatar: card.avatarText,
        source: `${card.place} · ${card.time}`,
        verified: card.verified,
      });
    });

    posts.forEach((post) => {
      if (!userMap.has(post.author)) {
        userMap.set(post.author, {
          name: post.author,
          avatar: post.avatar,
          source: `${post.channel} · ${post.place}`,
          verified: post.verified,
        });
      }
    });

    return Array.from(userMap.values());
  }, [cards, posts]);

  const matchedUsers = users.filter((user) => {
    const text = `${user.name} ${user.source}`.toLowerCase();
    return !keyword || text.includes(keyword);
  });

  const matchedCards = cards.filter((card) => {
    const text = `${card.nickname} ${card.text} ${card.time} ${card.place} ${card.people} ${card.tags.join(" ")}`.toLowerCase();
    return !keyword || text.includes(keyword);
  });

  const matchedPosts = posts.filter((post) => {
    const text = `${post.title} ${post.text} ${post.author} ${post.place} ${post.channel} ${post.topic}`.toLowerCase();
    return !keyword || text.includes(keyword);
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-[rgba(18,30,25,0.34)]">
      <section className="mx-auto flex h-full max-w-md flex-col bg-[var(--surface)] shadow-[0_20px_60px_rgba(18,30,25,0.24)]">
        <header className="border-b border-[var(--line-soft)] bg-[rgba(251,253,249,0.94)] px-4 pb-3 pt-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-3 ring-1 ring-[var(--line-soft)]">
              <Search className="h-[18px] w-[18px] shrink-0 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--text-main)] outline-none placeholder:text-[var(--text-faint)]"
                placeholder="搜索用户、约饭卡片、社区帖子"
              />
            </label>
            <button
              onClick={onClose}
              className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]"
              aria-label="关闭搜索"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
            {sections.map((item) => (
              <button
                key={item}
                onClick={() => setSection(item)}
                className={`h-8 shrink-0 rounded-lg px-3 text-[13px] font-black transition ${
                  section === item
                    ? "bg-[var(--pine)] text-white"
                    : "bg-white text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {(section === "全部" || section === "用户") && (
            <ResultGroup title="用户" count={matchedUsers.length}>
              {matchedUsers.slice(0, section === "全部" ? 3 : 20).map((user) => (
                <button key={user.name} className="flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left ring-1 ring-[var(--line-soft)]">
                  <span className="display-cn flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-[18px] text-[#28483f]">
                    {user.avatar}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-black text-[var(--text-main)]">{user.name}</span>
                      {user.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-[var(--moss)] text-white" />}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--text-muted)]">{user.source}</span>
                  </span>
                </button>
              ))}
            </ResultGroup>
          )}

          {(section === "全部" || section === "约饭卡片") && (
            <ResultGroup title="约饭卡片" count={matchedCards.length}>
              {matchedCards.slice(0, section === "全部" ? 3 : 20).map((card) => (
                <article key={card.id} className="rounded-lg bg-[var(--pine)] p-3 text-white shadow-[0_12px_26px_rgba(63,111,96,0.18)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="display-cn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fff7d7] text-[#28483f]">
                        {card.avatarText}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-black">{card.nickname}</p>
                        <p className="truncate text-xs font-bold text-[#d8eade]">{card.place} · {card.time}</p>
                      </div>
                    </div>
                    <span className="rounded-md bg-[rgba(255,247,215,0.22)] px-2 py-1 text-xs font-black text-[#ffedb8]">
                      {card.matchScore}%
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-[#fffdf3]">{card.text}</p>
                </article>
              ))}
            </ResultGroup>
          )}

          {(section === "全部" || section === "帖子") && (
            <ResultGroup title="帖子" count={matchedPosts.length}>
              {matchedPosts.slice(0, section === "全部" ? 4 : 30).map((post) => (
                <article key={post.id} className="rounded-lg bg-white p-3 ring-1 ring-[var(--line-soft)]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-md bg-[rgba(209,228,221,0.86)] px-2 py-1 text-[11px] font-black text-[var(--pine)]">
                      {post.channel}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-faint)]">
                      <MapPin className="h-3.5 w-3.5" />
                      {post.place}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 font-black leading-snug text-[var(--text-main)]">{post.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-muted)]">{post.text}</p>
                  <div className="mt-2 flex items-center justify-between text-xs font-bold text-[var(--text-faint)]">
                    <span className="flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" />
                      {post.author}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5">
                        <Heart className="h-3.5 w-3.5" />
                        {post.likes}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {post.comments}
                      </span>
                    </span>
                  </div>
                </article>
              ))}
            </ResultGroup>
          )}

          {!matchedUsers.length && !matchedCards.length && !matchedPosts.length && (
            <section className="mt-12 text-center">
              <Search className="mx-auto h-8 w-8 text-[var(--text-faint)]" />
              <h2 className="mt-3 font-black text-[var(--text-main)]">没有找到相关内容</h2>
              <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">换个关键词试试，比如“二食堂”“经验”“林同学”。</p>
            </section>
          )}
        </main>
      </section>
    </div>
  );
}

function ResultGroup({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-1.5 text-sm font-black text-[var(--text-main)]">
          {title === "约饭卡片" ? <Utensils className="h-4 w-4 text-[var(--pine)]" /> : <Sparkles className="h-4 w-4 text-[var(--pine)]" />}
          {title}
        </h2>
        <span className="text-xs font-bold text-[var(--text-faint)]">{count} 条</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
