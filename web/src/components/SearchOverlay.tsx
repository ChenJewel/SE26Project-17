import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, Search, Sparkles, Utensils, X } from "lucide-react";
import { CommunityPostPreviewGrid } from "@/components/post/CommunityPostPreviewCard";
import UserAvatar from "@/components/UserAvatar";
import type { CommunityPost } from "@/data/community";
import { searchAll, type SearchResponse } from "@/services/searchApi";
import type { FollowSummary } from "@/services/userApi";
import type { MealCard } from "@/types/meal";

interface SearchOverlayProps {
  open: boolean;
  cards: MealCard[];
  posts: CommunityPost[];
  onClose: () => void;
  onOpenUser: (name: string, userId?: string) => void;
  onOpenCard: (cardId: string) => void;
  onOpenPost: (postId: string) => void;
}

type SearchSection = "全部" | "用户" | "约饭卡" | "帖子";

interface UserResult {
  userId?: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  source: string;
  verified?: boolean;
  follow?: FollowSummary;
  highlights?: Record<string, string>;
}

type HighlightedMealCard = MealCard & { highlights?: Record<string, string> };
type HighlightedPost = CommunityPost & { highlights?: Record<string, string> };

const sections: SearchSection[] = ["全部", "用户", "约饭卡", "帖子"];

export default function SearchOverlay({ open, cards, posts, onClose, onOpenUser, onOpenCard, onOpenPost }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<SearchSection>("全部");
  const [remoteResults, setRemoteResults] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const keyword = query.trim().toLowerCase();
  const sectionIndex = Math.max(0, sections.indexOf(section));

  useEffect(() => {
    let cancelled = false;
    setSearchPage(1);
    if (!open || !keyword) {
      setRemoteResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(() => {
      searchAll(keyword, 20, 1)
        .then((result) => {
          if (!cancelled) setRemoteResults(result);
        })
        .catch((error) => {
          if (!cancelled) {
            console.warn("Backend search failed, using local results.", error);
            setRemoteResults(null);
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [keyword, open]);

  const loadMore = async () => {
    if (!keyword || !remoteResults?.hasMore || loadingMore) return;
    const nextPage = searchPage + 1;
    setLoadingMore(true);
    try {
      const result = await searchAll(keyword, remoteResults.limit ?? 20, nextPage);
      setRemoteResults((current) =>
        current
          ? {
              ...result,
              users: [...current.users, ...result.users],
              cards: [...current.cards, ...result.cards],
              posts: [...current.posts, ...result.posts],
            }
          : result
      );
      setSearchPage(nextPage);
    } catch (error) {
      console.warn("Load more search results failed.", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const localUsers = useMemo(() => {
    const userMap = new Map<string, UserResult>();
    cards.forEach((card) => {
      userMap.set(card.userId ?? card.nickname, {
        userId: card.userId,
        name: card.nickname,
        avatar: card.avatarText,
        avatarUrl: card.avatarUrl,
        source: `${card.place} · ${card.time}`,
        verified: card.verified,
      });
    });
    posts.forEach((post) => {
      const key = post.authorId ?? post.author;
      if (!userMap.has(key)) {
        userMap.set(key, {
          userId: post.authorId,
          name: post.author,
          avatar: post.avatar,
          avatarUrl: post.avatarUrl,
          source: `${post.channel} · ${post.place}`,
          verified: post.verified,
        });
      }
    });
    return Array.from(userMap.values());
  }, [cards, posts]);

  const matchedUsers: UserResult[] = remoteResults
    ? remoteResults.users.map((user) => ({
        userId: user.id,
        name: user.nickname,
        avatar: user.avatarText,
        avatarUrl: user.avatarUrl,
        source: user.school ?? user.email,
        verified: user.verified,
        follow: user.follow,
        highlights: user.highlights,
      }))
    : localUsers.filter((user) => !keyword || `${user.name} ${user.source}`.toLowerCase().includes(keyword));

  const matchedCards: HighlightedMealCard[] =
    remoteResults?.cards ??
    cards.filter((card) => {
      const text = `${card.nickname} ${card.text} ${card.time} ${card.place} ${card.people} ${card.tags.join(" ")}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });

  const matchedPosts: HighlightedPost[] =
    remoteResults?.posts ??
    posts.filter((post) => {
      const text = `${post.title} ${post.text} ${post.author} ${post.place} ${post.channel} ${post.topic}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });

  if (!open) return null;

  return (
    <div className="app-screen-overlay fixed inset-0 z-[70] bg-[rgba(18,30,25,0.28)]">
      <section className="app-push-panel mx-auto flex h-full max-w-md flex-col bg-[rgba(251,255,252,0.92)] shadow-[0_20px_60px_rgba(18,30,25,0.2)]">
        <header className="page-header px-4 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-3 ring-1 ring-[var(--line-soft)]">
              <Search className="h-[18px] w-[18px] shrink-0 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--text-main)] outline-none placeholder:text-[var(--text-faint)]"
                placeholder="搜索用户、约饭卡、社区帖子"
              />
            </label>
            <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]" aria-label="关闭搜索">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-3 grid grid-cols-4 rounded-lg bg-[rgba(236,247,242,0.76)] p-1 ring-1 ring-[var(--line-soft)]">
            <span
              className="absolute bottom-1 top-1 rounded-md bg-[var(--surface)] shadow-[0_6px_16px_rgba(23,43,37,0.1)] transition-transform duration-300"
              style={{ left: "4px", width: "calc(25% - 2px)", transform: `translateX(calc(${sectionIndex} * 100%))` }}
            />
            {sections.map((item) => (
              <button
                key={item}
                onClick={() => setSection(item)}
                className={`relative z-10 h-8 shrink-0 rounded-md px-2 text-[13px] font-black transition ${
                  section === item ? "text-[var(--pine)]" : "text-[var(--text-muted)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {searching ? <SearchSkeleton /> : null}
          {searching ? <p className="sr-only">正在搜索云端结果...</p> : null}
          {!searching && remoteResults?.suggestion ? (
            <button
              onClick={() => setQuery(remoteResults.suggestion ?? "")}
              className="mb-3 w-full rounded-lg bg-[rgba(255,247,215,0.86)] px-3 py-2 text-left text-xs font-black text-[#806636] ring-1 ring-[rgba(213,182,111,0.38)]"
            >
              你是不是想搜：{remoteResults.suggestion}
            </button>
          ) : null}

          {(section === "全部" || section === "用户") && (
            <ResultGroup title="用户" count={matchedUsers.length}>
              {matchedUsers.slice(0, section === "全部" ? 3 : 20).map((user) => (
                <button
                  key={user.userId ?? user.name}
                  onClick={() => onOpenUser(user.name, user.userId)}
                  className="flex w-full items-center gap-3 rounded-lg bg-white/88 p-3 text-left shadow-[0_8px_20px_rgba(23,43,37,0.06)] ring-1 ring-[var(--line-soft)]"
                >
                  <UserAvatar text={user.avatar} imageUrl={user.avatarUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-black text-[var(--text-main)]">
                        <HighlightText html={user.highlights?.nickname} fallback={user.name} />
                      </span>
                      {user.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-[var(--moss)] text-white" />}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--text-muted)]">
                      <HighlightText html={user.highlights?.school ?? user.highlights?.bio ?? user.highlights?.nickname} fallback={user.source} />
                    </span>
                    {user.follow ? (
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <RelationBadge follow={user.follow} />
                        <span className="rounded-md bg-[rgba(244,248,244,0.92)] px-2 py-1 text-[11px] font-black text-[var(--text-muted)]">
                          {user.follow.followerCount} 粉丝
                        </span>
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </ResultGroup>
          )}

          {(section === "全部" || section === "约饭卡") && (
            <ResultGroup title="约饭卡" count={matchedCards.length}>
              {matchedCards.slice(0, section === "全部" ? 3 : 20).map((card) => (
                <button
                  key={card.id}
                  onClick={() => onOpenCard(card.id)}
                  className="w-full rounded-lg bg-[var(--pine)] p-3 text-left text-white shadow-[0_12px_26px_rgba(63,111,96,0.18)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar text={card.avatarText} imageUrl={card.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-black">
                          <HighlightText html={card.highlights?.nickname} fallback={card.nickname} />
                        </p>
                        <p className="truncate text-xs font-bold text-[#d8eade]">
                          <HighlightText html={card.highlights?.place ?? card.highlights?.time} fallback={`${card.place} · ${card.time}`} />
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md bg-[rgba(255,247,215,0.22)] px-2 py-1 text-xs font-black text-[#ffedb8]">
                      {card.matchScore}%
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-[#fffdf3]">
                    <HighlightText html={card.highlights?.text ?? card.highlights?.tags} fallback={card.text} />
                  </p>
                </button>
              ))}
            </ResultGroup>
          )}

          {(section === "全部" || section === "帖子") && (
            <ResultGroup title="帖子" count={matchedPosts.length}>
              <CommunityPostPreviewGrid
                posts={matchedPosts.slice(0, section === "全部" ? 4 : 30)}
                onOpenPost={(post) => onOpenPost(post.id)}
              />
            </ResultGroup>
          )}

          {!matchedUsers.length && !matchedCards.length && !matchedPosts.length && (
            <section className="mt-12 text-center">
              <Search className="mx-auto h-8 w-8 text-[var(--text-faint)]" />
              <h2 className="mt-3 font-black text-[var(--text-main)]">没有找到相关内容</h2>
              <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">换个关键词试试，比如“二食堂”“经验”“同学”。</p>
            </section>
          )}

          {remoteResults?.hasMore ? (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mb-6 h-11 w-full rounded-lg bg-[rgba(209,228,221,0.72)] text-sm font-black text-[var(--pine)] disabled:opacity-50"
            >
              {loadingMore ? "加载中..." : "加载更多"}
            </button>
          ) : null}
        </main>
      </section>
    </div>
  );
}

function RelationBadge({ follow }: { follow: FollowSummary }) {
  const label = follow.mutual ? "互相关注" : follow.following ? "已关注" : follow.followedBy ? "关注了你" : "未关注";
  const active = follow.mutual || follow.following || follow.followedBy;
  return (
    <span className={`rounded-md px-2 py-1 text-[11px] font-black ${active ? "bg-[rgba(209,228,221,0.86)] text-[var(--pine)]" : "bg-[rgba(244,248,244,0.92)] text-[var(--text-muted)]"}`}>
      {label}
    </span>
  );
}

function HighlightText({ html, fallback }: { html?: string; fallback: string }) {
  if (!html) return <>{fallback}</>;
  const parts = html.split(/(<mark>|<\/mark>)/);
  let highlighted = false;
  return (
    <>
      {parts.map((part, index) => {
        if (part === "<mark>") {
          highlighted = true;
          return null;
        }
        if (part === "</mark>") {
          highlighted = false;
          return null;
        }
        return highlighted ? (
          <mark key={`${part}-${index}`} className="rounded-sm bg-[#fff0a8] px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      })}
    </>
  );
}

function ResultGroup({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-1.5 text-sm font-black text-[var(--text-main)]">
          {title === "约饭卡" ? <Utensils className="h-4 w-4 text-[var(--pine)]" /> : <Sparkles className="h-4 w-4 text-[var(--pine)]" />}
          {title}
        </h2>
        <span className="text-xs font-bold text-[var(--text-faint)]">{count} 条</span>
      </div>
      <div className="app-list-stagger space-y-2">{children}</div>
    </section>
  );
}

function SearchSkeleton() {
  return (
    <div className="mb-5 space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-lg bg-white/80 p-3 ring-1 ring-[var(--line-soft)]">
          <div className="flex items-center gap-3">
            <div className="app-skeleton h-11 w-11 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="app-skeleton h-3.5 w-2/3 rounded-full" />
              <div className="app-skeleton h-3 w-full rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
