import { useMemo, useRef, useState, type ReactElement, type TouchEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  Image as ImageIcon,
  MapPin,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Utensils,
  Video,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import type { MealCard } from "@/types/meal";

interface HomeProps {
  cards: MealCard[];
  tagOptions: string[];
  publishedCardId: string | null;
  onCreate: () => void;
  onInvite: (card: MealCard) => void;
  onSearch: () => void;
  onOpenUser: (name: string, userId?: string) => void;
  onOpenCard: (cardId: string) => void;
  onRefresh: () => Promise<void>;
}

type SpecialCard = "meal" | "create" | "ai";

const ALL_FILTER = "全部";
const swipeThreshold = 64;

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

const relatedFilterTerms: Record<string, string[]> = {
  晚饭: ["晚上", "晚餐", "夜宵", "下课后", "今晚"],
  午饭: ["中午", "午餐", "午休", "下课"],
  早饭: ["早上", "早餐", "晨间"],
  二食堂: ["二餐", "第二食堂", "2食堂", "2餐"],
  一食堂: ["一餐", "第一食堂", "1食堂", "1餐"],
  三食堂: ["三餐", "第三食堂", "3食堂", "3餐"],
  四食堂: ["四餐", "第四食堂", "4食堂", "4餐"],
  不吃辣: ["清淡", "少辣", "微辣", "不辣"],
  清淡: ["不吃辣", "少油", "少盐", "养胃"],
  安静一点: ["安静", "慢热", "社恐友好", "不尬聊", "自习"],
  喜欢安静: ["安静", "慢热", "社恐友好", "不尬聊", "自习"],
  社恐友好: ["慢热", "安静", "不尬聊", "轻松"],
  可以聊天: ["聊天", "话多", "交流", "轻松聊"],
  想尝新: ["尝鲜", "探店", "新店", "新菜", "随便吃"],
  图书馆: ["自习", "学习", "考研", "复习"],
  考研党: ["自习", "图书馆", "复习", "学习"],
  散步: ["饭后走走", "走路", "操场", "消食"],
};

function getCardFilterScore(card: MealCard, filter: string) {
  const queryTerms = expandFilterTerms(filter);
  if (!queryTerms.length) return 0;

  const fieldScores = [
    { text: card.tags.join(" "), weight: 0.5 },
    { text: card.text, weight: 0.24 },
    { text: card.place, weight: 0.12 },
    { text: card.time, weight: 0.08 },
    { text: card.people, weight: 0.06 },
  ];

  return Math.max(
    ...queryTerms.map((query) =>
      fieldScores.reduce((total, field) => total + textRelevance(query, field.text) * field.weight, 0)
    )
  );
}

function expandFilterTerms(filter: string) {
  const normalized = normalizeSearchText(filter);
  if (!normalized) return [];
  const related = relatedFilterTerms[filter] ?? relatedFilterTerms[normalized] ?? [];
  return normalizeTags([filter, normalized, ...related]).map(normalizeSearchText).filter(Boolean);
}

function textRelevance(query: string, text: string) {
  const target = normalizeSearchText(text);
  if (!query || !target) return 0;
  if (target === query) return 1;
  if (target.includes(query) || query.includes(target)) return 0.9;

  const queryParts = splitSearchText(query);
  const targetParts = splitSearchText(target);
  const partHits = queryParts.filter((part) => target.includes(part) || targetParts.includes(part)).length;
  const partScore = queryParts.length ? partHits / queryParts.length : 0;

  return Math.max(partScore * 0.72, diceCoefficient(query, target) * 0.68);
}

function splitSearchText(value: string) {
  return normalizeSearchText(value)
    .split(/[\s,，.。/、|·_-]+/)
    .flatMap((part) => (part.length > 2 ? [part, ...getBigrams(part)] : [part]))
    .filter(Boolean);
}

function diceCoefficient(left: string, right: string) {
  const leftBigrams = getBigrams(left);
  const rightBigrams = getBigrams(right);
  if (!leftBigrams.length || !rightBigrams.length) return 0;

  const rightCounts = new Map<string, number>();
  for (const item of rightBigrams) rightCounts.set(item, (rightCounts.get(item) ?? 0) + 1);

  let overlap = 0;
  for (const item of leftBigrams) {
    const count = rightCounts.get(item) ?? 0;
    if (count <= 0) continue;
    overlap += 1;
    rightCounts.set(item, count - 1);
  }

  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

function getBigrams(value: string) {
  const normalized = normalizeSearchText(value);
  if (normalized.length <= 1) return normalized ? [normalized] : [];
  return Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2));
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[\s,，.。/、|·_：:;；!?！？'"“”‘’()（）[\]{}-]+/g, "");
}

function wrapIndex(index: number, length: number) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}

export default function Home({
  cards,
  tagOptions,
  publishedCardId,
  onCreate,
  onInvite,
  onSearch,
  onOpenUser,
  onOpenCard,
  onRefresh,
}: HomeProps) {
  const [cardIndex, setCardIndex] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [toast, setToast] = useState("");
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [promoting, setPromoting] = useState<{
    card: MealCard;
    targetIndex: number;
    direction: "left" | "right";
  } | null>(null);
  const [promoteActive, setPromoteActive] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const promoteTimer = useRef<number | null>(null);
  const pullStartY = useRef<number | null>(null);
  const touchPullStart = useRef<{ x: number; y: number } | null>(null);
  const touchPullActive = useRef(false);

  const filterItems = useMemo(
    () => normalizeTags([ALL_FILTER, ...tagOptions.filter((tag) => tag !== ALL_FILTER)]),
    [tagOptions]
  );

  const filteredCards = useMemo(() => {
    if (!activeFilters.length) return cards;
    return cards
      .map((card) => ({
        card,
        filterScore: activeFilters.reduce((total, filter) => total + getCardFilterScore(card, filter), 0) / activeFilters.length,
      }))
      .filter(({ card }) => activeFilters.every((filter) => getCardFilterScore(card, filter) >= 0.28))
      .sort((left, right) => right.filterScore - left.filterScore || right.card.matchScore - left.card.matchScore)
      .map(({ card }) => card);
  }, [activeFilters, cards]);

  const cardPool = activeFilters.length ? filteredCards : cards;
  const poolLength = cardPool.length;
  const activeIndex = wrapIndex(cardIndex, poolLength);
  const currentCard = poolLength ? cardPool[activeIndex] : null;
  const previewOffset = dragX < 0 ? -1 : 1;
  const previewCard = poolLength > 1 ? cardPool[wrapIndex(cardIndex + previewOffset, poolLength)] : null;
  const dragProgress = Math.min(1, Math.abs(dragX) / 150);

  const specialCard = useMemo<SpecialCard>(() => {
    if (!publishedCardId && swipeCount === 4) return "create";
    if (swipeCount > 0 && swipeCount % 9 === 0) return "ai";
    return "meal";
  }, [publishedCardId, swipeCount]);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  };

  const resetSwipe = () => {
    setDragStart(null);
    setDragX(0);
  };

  const completeCardChange = (targetIndex: number) => {
    setCardIndex(wrapIndex(targetIndex, poolLength));
    setSwipeCount((current) => current + 1);
  };

  const previousCard = () => {
    if (!poolLength) return;
    completeCardChange(cardIndex - 1);
  };

  const nextCard = () => {
    if (!poolLength) return;
    completeCardChange(cardIndex + 1);
  };

  const promoteCard = (targetIndex: number, direction: "left" | "right") => {
    if (!poolLength) return;
    const normalizedIndex = wrapIndex(targetIndex, poolLength);
    const targetCard = cardPool[normalizedIndex];
    if (!targetCard) return;

    resetSwipe();
    setPromoting({ card: targetCard, targetIndex: normalizedIndex, direction });
    setPromoteActive(false);

    window.requestAnimationFrame(() => {
      setPromoteActive(true);
    });

    if (promoteTimer.current) window.clearTimeout(promoteTimer.current);
    promoteTimer.current = window.setTimeout(() => {
      completeCardChange(normalizedIndex);
      setPromoting(null);
      setPromoteActive(false);
    }, 260);
  };

  const invite = () => {
    if (!currentCard) return;
    showToast(`已向 ${currentCard.nickname} 发出约饭邀请`);
    onInvite(currentCard);
  };

  const beginPullRefresh = (event: React.PointerEvent<HTMLElement>) => {
    if (refreshing || event.pointerType === "mouse") return;
    if (window.scrollY > 2) return;
    pullStartY.current = event.clientY;
  };

  const updatePullRefresh = (event: React.PointerEvent<HTMLElement>) => {
    if (pullStartY.current === null || refreshing) return;
    const distance = Math.max(0, event.clientY - pullStartY.current);
    if (distance > 0) setPullDistance(Math.min(92, distance * 0.45));
  };

  const finishPullRefresh = async () => {
    if (pullStartY.current === null) return;
    const shouldRefresh = pullDistance >= 54;
    pullStartY.current = null;

    if (!shouldRefresh) {
      setPullDistance(0);
      return;
    }

    setRefreshing(true);
    setPullDistance(64);
    try {
      await onRefresh();
      showToast("已刷新");
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  };

  const beginTouchPullRefresh = (event: TouchEvent<HTMLElement>) => {
    if (refreshing || window.scrollY > 2 || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchPullStart.current = { x: touch.clientX, y: touch.clientY };
    pullStartY.current = touch.clientY;
    touchPullActive.current = false;
  };

  const updateTouchPullRefresh = (event: TouchEvent<HTMLElement>) => {
    if (!touchPullStart.current || refreshing || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchPullStart.current.x;
    const dy = touch.clientY - touchPullStart.current.y;

    if (!touchPullActive.current) {
      if (dy < 8) return;
      if (Math.abs(dx) > dy) {
        touchPullStart.current = null;
        pullStartY.current = null;
        setPullDistance(0);
        return;
      }
      touchPullActive.current = true;
    }

    event.preventDefault();
    setPullDistance(Math.min(104, dy * 0.52));
  };

  const finishTouchPullRefresh = () => {
    if (!touchPullStart.current && !touchPullActive.current) return;
    touchPullStart.current = null;
    touchPullActive.current = false;
    void finishPullRefresh();
  };

  const selectFilter = (tag: string) => {
    setActiveFilters((current) => {
      if (tag === ALL_FILTER) return [];
      return current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag];
    });
    setCardIndex(0);
    setSwipeCount(0);
    resetSwipe();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setDragStart(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart === null) return;
    const nextDrag = event.clientX - dragStart;
    setDragX(Math.max(-150, Math.min(150, nextDrag)));
  };

  const finishSwipe = () => {
    const finalX = dragX;

    if (finalX < -swipeThreshold) {
      promoteCard(cardIndex - 1, "left");
      return;
    }

    if (finalX > swipeThreshold) {
      promoteCard(cardIndex + 1, "right");
      return;
    }

    resetSwipe();
  };

  const emptyState = !currentCard;

  return (
    <main
      className="app-shell home-sky-shell h-[100dvh] overflow-hidden"
      onTouchStart={beginTouchPullRefresh}
      onTouchMove={updateTouchPullRefresh}
      onTouchEnd={finishTouchPullRefresh}
      onTouchCancel={() => {
        touchPullStart.current = null;
        touchPullActive.current = false;
        setPullDistance(0);
      }}
      onPointerDown={beginPullRefresh}
      onPointerMove={updatePullRefresh}
      onPointerUp={finishPullRefresh}
      onPointerCancel={() => {
        pullStartY.current = null;
        setPullDistance(0);
      }}
    >
      <div
        className="pointer-events-none fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[rgba(251,253,249,0.94)] px-3 py-2 text-xs font-black text-[var(--pine)] shadow-sm ring-1 ring-[var(--line-soft)] transition"
        style={{ opacity: pullDistance > 6 || refreshing ? 1 : 0, transform: `translate(-50%, ${pullDistance}px)` }}
      >
        <RotateCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "刷新中..." : pullDistance >= 54 ? "松开刷新" : "下拉刷新"}
      </div>
      <section className="mx-auto flex h-full max-w-md flex-col px-4 pt-4">
        <header className="shrink-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--moss)]">ueat</p>
              <h1 className="display-cn text-[27px] leading-tight text-[var(--pine)]">今天和谁一起吃？</h1>
            </div>
              <button
                aria-label="搜索约饭卡片"
                onClick={onSearch}
                className="home-glass-control flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line-soft)] bg-white/80 text-[var(--pine)] shadow-sm"
              >
                <Search className="h-5 w-5" />
              </button>
          </div>

          <div className="soft-panel rounded-lg p-2.5">
            <div className={`overflow-hidden transition-[max-height] duration-300 ${tagsExpanded ? "max-h-[118px]" : "max-h-9"}`}>
              <div className="flex flex-wrap gap-2">
                {filterItems.map((tag) => {
                  const active = tag === ALL_FILTER ? activeFilters.length === 0 : activeFilters.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => selectFilter(tag)}
                      className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition ${
                        active
              ? "bg-[var(--pine)] text-white shadow-[0_8px_18px_rgba(79,143,114,0.24)]"
                          : "bg-white/74 text-[var(--text-muted)]"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => setTagsExpanded((current) => !current)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1 text-xs font-semibold text-[var(--moss)]"
            >
              {tagsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {tagsExpanded ? "收起标签" : activeFilters.length ? `已选 ${activeFilters.length} 个标签` : "展开更多标签"}
            </button>
          </div>
        </header>

        <section className="relative mt-3 min-h-0 flex-1">
          {emptyState ? (
            <EmptyCard onCreate={onCreate} />
          ) : specialCard === "create" ? (
            <SpecialPromptCard
              icon={<Utensils className="h-8 w-8" />}
              title="发一张自己的约饭卡"
              text="让别人知道你的饭点、地点和相处节奏，匹配会更准确。"
              action="现在发布"
              onAction={onCreate}
              onSkip={nextCard}
            />
          ) : specialCard === "ai" ? (
            <SpecialPromptCard
              icon={<Sparkles className="h-8 w-8" />}
              title="让 AI 帮你找饭搭子"
              text="根据你的时间、餐厅和聊天偏好，生成更合适的推荐理由。"
              action="试试 AI 匹配"
              onAction={() => showToast("AI 匹配原型已开启")}
              onSkip={nextCard}
            />
          ) : (
            <div className="absolute inset-0">
              {previewCard && !promoting ? (
                <PreviewMealCard card={previewCard} progress={dragProgress} direction={dragX < 0 ? "left" : "right"} />
              ) : null}
              <div
                className="absolute inset-0 touch-none select-none"
                style={{
                  transform: promoting
                    ? `translateY(${promoteActive ? -8 : 0}px) scale(${promoteActive ? 0.965 : 1})`
                    : `translateX(${dragX}px) rotate(${dragX / 34}deg)`,
                  opacity: promoting && promoteActive ? 0.72 : 1,
                  transition: promoting ? "transform 260ms ease, opacity 260ms ease" : dragStart === null ? "transform 180ms ease" : "none",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={finishSwipe}
                onPointerCancel={resetSwipe}
                onClick={() => {
                  if (Math.abs(dragX) < 8 && currentCard) onOpenCard(currentCard.id);
                }}
              >
                <MealSwipeCard card={currentCard} onOpenUser={() => onOpenUser(currentCard.nickname, currentCard.userId)} />
              </div>
              {promoting ? (
                <div
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{
                    opacity: promoteActive ? 1 : 0.72,
                    transform: promoteActive
                      ? "translate3d(0, 0, 0) scale(1)"
                      : `translate3d(${promoting.direction === "right" ? 18 : -18}px, 30px, 0) scale(0.935)`,
                    transition: "transform 260ms cubic-bezier(0.2, 0.82, 0.2, 1), opacity 260ms ease",
                  }}
                >
                  <MealSwipeCard card={promoting.card} onOpenUser={() => onOpenUser(promoting.card.nickname, promoting.card.userId)} />
                </div>
              ) : null}
            </div>
          )}
        </section>

        <footer className="shrink-0 pb-3 pt-3">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold text-[var(--text-faint)]">
            <ArrowLeft className="h-4 w-4" />
            左滑上一张
            <span className="h-1 w-1 rounded-full bg-[var(--text-faint)]" />
            右滑下一张
            <ArrowRight className="h-4 w-4" />
          </div>
          <div className="grid grid-cols-[1fr_1.2fr] gap-3">
            <button
              onClick={previousCard}
              className="home-glass-control flex h-12 items-center justify-center gap-2 rounded-lg border border-[var(--line-soft)] bg-white/80 text-sm font-bold text-[var(--pine)] shadow-sm"
            >
              <RotateCcw className="h-4 w-4" />
              上一张
            </button>
            <button
              onClick={invite}
              disabled={!currentCard}
        className="h-12 rounded-lg bg-[var(--pine)] text-sm font-bold text-white shadow-[0_14px_26px_rgba(79,143,114,0.28)] disabled:opacity-50"
            >
              想一起吃
            </button>
          </div>
        </footer>
      </section>

      {toast ? (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full bg-[rgba(33,53,45,0.9)] px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function PreviewMealCard({ card, progress, direction }: { card: MealCard; progress: number; direction: "left" | "right" }) {
  return (
    <article
        className="meal-card meal-card-environment absolute inset-x-4 bottom-4 top-5 rounded-lg p-6"
      style={{
        opacity: 0.48 + progress * 0.42,
        transform: `translate3d(${(direction === "right" ? 16 : -16) * (1 - progress)}px, ${22 - progress * 18}px, 0) scale(${
          0.93 + progress * 0.06
        })`,
        transition: "opacity 120ms ease, transform 120ms ease",
      }}
    >
      <div className="flex items-center gap-3 opacity-85">
        <UserAvatar text={card.avatarText} imageUrl={card.avatarUrl} className="bg-white/18" />
        <div>
          <h2 className="text-lg font-black">{card.nickname}</h2>
          <p className="text-xs text-[rgba(24,54,68,0.64)]">{card.reason}</p>
        </div>
      </div>
      <MealCardMedia card={card} className="mt-4 h-28 opacity-90" />
      <div className="mt-8 text-3xl font-black leading-tight opacity-90">{card.matchScore}%</div>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-[rgba(31,55,66,0.72)]">{card.text}</p>
    </article>
  );
}

function MealSwipeCard({ card, onOpenUser }: { card: MealCard; onOpenUser: () => void }) {
  return (
    <article className="home-floating-card meal-card meal-card-environment flex h-full flex-col rounded-lg p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onOpenUser();
            }}
            className="flex h-14 w-14 items-center justify-center"
            aria-label={`查看${card.nickname}主页`}
          >
            <UserAvatar text={card.avatarText} imageUrl={card.avatarUrl} className="h-14 w-14 bg-white/44 text-xl ring-1 ring-white/70" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xl font-black">{card.nickname}</h2>
          {card.verified ? <BadgeCheck className="h-4 w-4 text-[var(--moss)]" /> : null}
            </div>
            <p className="text-xs font-semibold text-[rgba(31,55,66,0.64)]">匹配理由：{card.reason}</p>
          </div>
        </div>
        <div className="meal-card-score rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] font-bold uppercase text-[rgba(31,55,66,0.54)]">match</p>
          <p className="text-xl font-black">{card.matchScore}%</p>
        </div>
      </div>

      <MealCardMedia card={card} className="mt-5 h-36" />

      <div className="mt-6 grid grid-cols-2 gap-2 text-sm font-semibold text-[rgba(31,55,66,0.82)]">
        <InfoPill icon={<Clock3 className="h-4 w-4" />} text={card.time} />
        <InfoPill icon={<MapPin className="h-4 w-4" />} text={card.place} />
        <InfoPill icon={<Utensils className="h-4 w-4" />} text={card.people} />
        <InfoPill icon={<Sparkles className="h-4 w-4" />} text="节奏相近" />
      </div>

      <p className="mt-7 flex-1 text-[21px] font-black leading-[1.45] text-[#1f3742]">{card.text}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {card.tags.slice(0, 6).map((tag) => (
          <span key={tag} className="tag-chip rounded-full px-3 py-1.5 text-xs font-bold">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

function MealCardMedia({ card, className = "" }: { card: MealCard; className?: string }) {
  if (!card.mediaUrl || !card.mediaType) return null;

  return (
    <div className={`relative overflow-hidden rounded-lg bg-black/20 ring-1 ring-white/15 ${className}`}>
      {card.mediaType === "video" ? (
        <>
          <video src={card.mediaUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </>
      ) : (
        <img src={card.mediaUrl} alt="约饭卡媒体" className="h-full w-full object-cover" loading="lazy" />
      )}
      <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-white/70 text-[var(--pine)] backdrop-blur">
        {card.mediaType === "video" ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
      </span>
    </div>
  );
}

function InfoPill({ icon, text }: { icon: ReactElement; text: string }) {
  return (
    <div className="meta-cell flex min-w-0 items-center gap-2 rounded-md px-3 py-2">
      <span className="shrink-0 text-[rgba(31,55,66,0.68)]">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
}

function SpecialPromptCard({
  icon,
  title,
  text,
  action,
  onAction,
  onSkip,
}: {
  icon: ReactElement;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
  onSkip: () => void;
}) {
  return (
    <article className="soft-panel flex h-full flex-col justify-between rounded-lg p-6">
      <div>
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-[var(--pine)] text-white">{icon}</div>
        <h2 className="mt-6 text-2xl font-black text-[var(--pine)]">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{text}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onSkip} className="h-12 rounded-lg bg-white text-sm font-bold text-[var(--pine)] shadow-sm">
          稍后再说
        </button>
        <button onClick={onAction} className="h-12 rounded-lg bg-[var(--pine)] text-sm font-bold text-white shadow-sm">
          {action}
        </button>
      </div>
    </article>
  );
}

function EmptyCard({ onCreate }: { onCreate: () => void }) {
  return (
    <article className="soft-panel flex h-full flex-col items-center justify-center rounded-lg p-8 text-center">
      <Utensils className="h-10 w-10 text-[var(--moss)]" />
      <h2 className="mt-5 text-xl font-black text-[var(--pine)]">还没有可推荐的卡片</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">先发布自己的约饭卡，让系统知道你今天想怎么吃。</p>
      <button onClick={onCreate} className="mt-6 h-12 rounded-lg bg-[var(--pine)] px-6 text-sm font-bold text-white">
        发布约饭卡
      </button>
    </article>
  );
}
