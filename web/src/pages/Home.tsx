import { useMemo, useRef, useState, type CSSProperties, type ReactElement, type TouchEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  Image as ImageIcon,
  MapPin,
  MoreHorizontal,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Utensils,
  Video,
} from "lucide-react";
import { BackgroundPickerView } from "@/components/BackgroundPickerView";
import UserAvatar from "@/components/UserAvatar";
import { useBackgroundPreferences } from "@/hooks/useBackgroundPreferences";
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
  currentUserId?: string;
}

type SpecialCard = "meal" | "create" | "ai";

const ALL_FILTER = "全部";
const relatedTerms: Record<string, string[]> = {
  晚饭: ["晚餐", "晚上", "今晚", "18:", "19:"],
  午饭: ["午餐", "中午", "12:"],
  安静: ["自习", "图书馆", "少说话", "不吵"],
  聊天: ["聊", "话题", "交流"],
  健身: ["运动", "跑步", "训练"],
  清淡: ["不辣", "少油", "轻食"],
};

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function wrapIndex(index: number, length: number) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}

function rubberband(value: number, limit: number, constant = 0.58) {
  const sign = Math.sign(value);
  const distance = Math.abs(value);
  if (distance <= limit) return value;
  const overshoot = distance - limit;
  return sign * (limit + (overshoot * limit * constant) / (limit + constant * overshoot));
}

function project(initialVelocity: number, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function cardMatchesFilter(card: MealCard, filter: string) {
  const query = normalizeSearchText(filter);
  if (!query) return true;

  const haystack = normalizeSearchText([
    ...card.tags,
    card.text,
    card.place,
    card.people,
    card.reason,
    card.nickname,
    card.time,
  ].join(" "));

  if (haystack.includes(query)) return true;
  const aliases = relatedTerms[filter] ?? relatedTerms[query] ?? [];
  return aliases.some((term) => haystack.includes(normalizeSearchText(term)));
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
  currentUserId,
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
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const { homeBackground, setHomeBackground } = useBackgroundPreferences(currentUserId);
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
  const draggedCard = useRef(false);
  const dragStartRef = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const swipeHistory = useRef<Array<{ x: number; t: number }>>([]);

  const filterItems = useMemo(
    () => normalizeTags([ALL_FILTER, ...tagOptions.filter((tag) => tag !== ALL_FILTER)]),
    [tagOptions]
  );

  const filteredCards = useMemo(() => {
    if (!activeFilters.length) return cards;
    return cards.filter((card) => activeFilters.every((tag) => cardMatchesFilter(card, tag)));
  }, [activeFilters, cards]);

  const cardPool = activeFilters.length ? filteredCards : cards;
  const poolLength = cardPool.length;
  const activeIndex = wrapIndex(cardIndex, poolLength);
  const currentCard = poolLength ? cardPool[activeIndex] : null;
  const previewCard =
    dragStart !== null && poolLength > 1 && Math.abs(dragX) > 8
      ? cardPool[wrapIndex(activeIndex + (dragX > 0 ? 1 : -1), poolLength)]
      : null;
  const dragProgress = Math.min(1, Math.abs(dragX) / 118);
  const swipeThreshold = 86;

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
    dragStartRef.current = null;
    dragXRef.current = 0;
    swipeHistory.current = [];
    setDragStart(null);
    setDragX(0);
  };

  const completeCardChange = (targetIndex: number) => {
    setCardIndex(wrapIndex(targetIndex, poolLength));
    setSwipeCount((current) => current + 1);
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

  const startSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!currentCard || promoting || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggedCard.current = false;
    dragStartRef.current = event.clientX;
    dragXRef.current = 0;
    swipeHistory.current = [{ x: event.clientX, t: performance.now() }];
    setDragStart(event.clientX);
    setDragX(0);
  };

  const updateSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const startX = dragStartRef.current;
    if (startX === null || promoting) return;
    event.stopPropagation();
    const nextX = rubberband(event.clientX - startX, 150);
    if (Math.abs(nextX) > 6) draggedCard.current = true;
    dragXRef.current = nextX;
    swipeHistory.current = [...swipeHistory.current, { x: event.clientX, t: performance.now() }].slice(-5);
    setDragX(nextX);
  };

  const finishSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current === null) return;
    event.stopPropagation();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }

    const samples = swipeHistory.current;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const velocity = first && last && last.t !== first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0;
    const offset = dragXRef.current;
    const projected = offset + project(velocity);
    const shouldFlip = Math.abs(offset) >= swipeThreshold || Math.abs(projected) >= 150 || Math.abs(velocity) >= 720;

    if (shouldFlip) {
      const direction = projected > 0 || (projected === 0 && offset > 0) ? "right" : "left";
      promoteCard(activeIndex + (direction === "right" ? 1 : -1), direction);
      return;
    }

    resetSwipe();
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

  const emptyState = !currentCard;

  return (
    <main
      className={`app-shell home-shell relative h-[100dvh] overflow-hidden pb-[86px] ${homeBackground ? "home-shell-custom-bg" : ""}`}
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
      {homeBackground ? (
        <div className="pointer-events-none absolute inset-0 z-0">
          <img src={homeBackground.url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(237,246,242,0.34)_42%,rgba(237,246,242,0.58))]" />
        </div>
      ) : null}
      <div
        className="pointer-events-none fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[rgba(251,253,249,0.94)] px-3 py-2 text-xs font-black text-[var(--pine)] shadow-sm ring-1 ring-[var(--line-soft)] transition"
        style={{ opacity: pullDistance > 6 || refreshing ? 1 : 0, transform: `translate(-50%, ${pullDistance}px)` }}
      >
        <RotateCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "刷新中..." : pullDistance >= 54 ? "松开刷新" : "下拉刷新"}
      </div>
      <section className="relative z-10 mx-auto flex h-full max-w-md flex-col px-4 pt-4">
        <header className="shrink-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--moss)]">ueat</p>
              <h1 className="display-cn text-[27px] leading-tight text-[var(--pine)]">今天和谁一起吃？</h1>
            </div>
            <div className="relative flex items-center gap-2">
              <button
                aria-label="搜索约饭卡片"
                onClick={onSearch}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line-soft)] bg-white/80 text-[var(--pine)] shadow-sm"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                aria-label="首页更多设置"
                onClick={() => setHomeMenuOpen((open) => !open)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line-soft)] bg-white/80 text-[var(--pine)] shadow-sm"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {homeMenuOpen ? (
                <div className="app-popover-menu absolute right-0 top-12 z-30 w-44 overflow-hidden rounded-lg bg-white/92 p-1 text-left shadow-[0_18px_42px_rgba(15,43,36,0.16)] ring-1 ring-[var(--line-soft)] backdrop-blur-xl">
                  <button
                    onClick={() => {
                      setHomeMenuOpen(false);
                      setBackgroundPickerOpen(true);
                    }}
                    className="w-full rounded-md px-3 py-3 text-left text-sm font-black text-[var(--text-main)]"
                  >
                    设置首页背景
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="soft-panel rounded-lg p-2.5">
            <div className={`overflow-hidden transition-[max-height] duration-300 ${tagsExpanded ? "max-h-[118px]" : "max-h-9"}`}>
              <div className="app-list-stagger flex flex-wrap gap-2">
                {filterItems.map((tag, index) => {
                  const active = tag === ALL_FILTER ? activeFilters.length === 0 : activeFilters.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => selectFilter(tag)}
                      style={{ "--stagger-index": index } as CSSProperties}
                      className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition ${
                        active
                          ? "bg-[var(--pine)] text-white shadow-[0_8px_18px_rgba(36,116,95,0.2)]"
                          : "bg-white/78 text-[var(--text-muted)] ring-1 ring-white/70"
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
              {poolLength > 1 && !promoting ? (
                <div
                  className="home-card-backplate pointer-events-none absolute inset-x-4 bottom-7 top-9 rounded-lg"
                  style={{
                    opacity: previewCard ? 0.18 + dragProgress * 0.18 : 0.32,
                    transform: previewCard
                      ? `translate3d(${dragX < 0 ? 22 : -22}px, ${16 - dragProgress * 8}px, 0) scale(${0.94 + dragProgress * 0.02})`
                      : "translate3d(30px, 22px, 0) scale(0.94)",
                  }}
                />
              ) : null}
              {previewCard && !promoting ? (
                <PreviewMealCard card={previewCard} progress={dragProgress} direction={dragX < 0 ? "left" : "right"} />
              ) : null}
              <div
                className={`swipe-card absolute inset-0 touch-pan-y select-none ${dragStart === null && !promoting ? "swipe-card-idle" : "swipe-card-active"}`}
                style={{
                  transform: promoting
                    ? `translateY(${promoteActive ? -8 : 0}px) scale(${promoteActive ? 0.965 : 1})`
                    : `translate3d(${dragX}px, ${Math.abs(dragX) * -0.018}px, 0) rotate(${dragX / 34}deg)`,
                  opacity: promoting && promoteActive ? 0.72 : 1,
                  transition: promoting ? "transform 280ms var(--spring-soft), opacity 220ms ease" : dragStart === null ? "transform 360ms var(--spring-soft)" : "none",
                }}
                onClick={() => {
                  if (draggedCard.current) {
                    draggedCard.current = false;
                    return;
                  }
                  if (Math.abs(dragX) < 8 && currentCard) onOpenCard(currentCard.id);
                }}
                onPointerDown={startSwipe}
                onPointerMove={updateSwipe}
                onPointerUp={finishSwipe}
                onPointerCancel={finishSwipe}
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
            上一张
            <span className="h-1 w-1 rounded-full bg-[var(--text-faint)]" />
            下一张
            <ArrowRight className="h-4 w-4" />
          </div>
          <div className="grid grid-cols-[0.92fr_1.1fr] gap-3">
            <button
              onClick={nextCard}
              disabled={!currentCard}
              className="home-secondary-action app-pressable flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              换一个
            </button>
            <button
              onClick={invite}
              disabled={!currentCard}
              className="home-primary-action app-pressable h-12 w-full rounded-lg text-sm font-bold text-white disabled:opacity-50"
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
      {backgroundPickerOpen ? (
        <BackgroundPickerView
          title="首页背景"
          currentBackground={homeBackground}
          onBack={() => setBackgroundPickerOpen(false)}
          onSelect={setHomeBackground}
        />
      ) : null}
    </main>
  );
}

function PreviewMealCard({ card, progress, direction }: { card: MealCard; progress: number; direction: "left" | "right" }) {
  return (
    <article
      className="meal-card absolute inset-x-4 bottom-4 top-5 rounded-lg p-6"
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
          <p className="text-xs text-white/70">{card.reason}</p>
        </div>
      </div>
      <MealCardMedia card={card} className="mt-4 h-28 opacity-90" />
      <div className="mt-8 text-3xl font-black leading-tight opacity-90">{card.matchScore}%</div>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/80">{card.text}</p>
    </article>
  );
}

function MealSwipeCard({ card, onOpenUser }: { card: MealCard; onOpenUser: () => void }) {
  return (
    <article className="home-floating-card meal-card flex h-full flex-col rounded-lg p-5">
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
            <UserAvatar text={card.avatarText} imageUrl={card.avatarUrl} className="h-14 w-14 bg-white/18 text-xl" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xl font-black">{card.nickname}</h2>
              {card.verified ? <BadgeCheck className="h-4 w-4 text-[#f8dc8a]" /> : null}
            </div>
            <p className="text-xs font-semibold text-white/68">匹配理由：{card.reason}</p>
          </div>
        </div>
        <div className="rounded-lg bg-white/14 px-3 py-2 text-center">
          <p className="text-[10px] font-bold uppercase text-white/58">match</p>
          <p className="text-xl font-black">{card.matchScore}%</p>
        </div>
      </div>

      <MealCardMedia card={card} className="mt-4 h-28" />

      <div className="mt-4 grid grid-cols-2 gap-2 text-white">
        <InfoPill icon={<Clock3 className="h-4 w-4" />} label="时间" text={card.time} />
        <InfoPill icon={<MapPin className="h-4 w-4" />} label="地点" text={card.place} />
        <InfoPill icon={<Utensils className="h-4 w-4" />} label="人数" text={card.people} />
        <InfoPill icon={<Sparkles className="h-4 w-4" />} label="节奏" text="相近" />
      </div>

      <div
        className="mt-4 h-[96px] shrink-0 rounded-lg border border-white/20 bg-white/[0.10] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <span className="text-3xl font-black leading-none text-white/24">“</span>
          <p className="text-[11px] font-black uppercase text-white/52">invitation</p>
        </div>
        <div className="meal-invitation-scroll -mt-0.5 max-h-[52px] overflow-y-auto overscroll-contain pr-3">
          <p className="text-[19px] font-black leading-[1.36] text-white">{card.text}</p>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto border-t border-white/16 pt-3 no-scrollbar">
        {card.tags.slice(0, 6).map((tag) => (
          <span key={tag} className="shrink-0 rounded-full border border-white/24 bg-white/12 px-3 py-1 text-xs font-bold text-white/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
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

function InfoPill({ icon, label, text }: { icon: ReactElement; label: string; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/24 bg-white/[0.14] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/16 text-white/86">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-black leading-none text-white/50">{label}</span>
        <span className="mt-1 block truncate text-sm font-black leading-tight text-white/92">{text}</span>
      </span>
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
