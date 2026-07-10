/**
 * 首页划卡与标签筛选页面。
 *
 * 维护要点：
 * - `tagOptions` 来自 App 的全局标签池，发卡片新增的标签会同步到这里。
 * - 标签区默认折叠为两行，避免首页顶部被大量标签占满；展开后仍限制高度并允许纵向滚动。
 * - 左滑切换下一张约饭卡，右滑进入邀请流程；按钮点击会阻止冒泡，避免和拖拽手势冲突。
 * - 暂无匹配标签卡片时显示引导卡，让用户可以直接去发布对应标签的约饭卡。
 */
import { useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
  Utensils,
} from "lucide-react";
import type { MealCard } from "@/pages/CreateCard";

interface HomeProps {
  cards: MealCard[];
  tagOptions: string[];
  publishedCardId: string | null;
  onCreate: () => void;
  onInvite: (card: MealCard) => void;
  onSearch: () => void;
}

type SpecialCard = "meal" | "create" | "ai";

const ALL_FILTER = "全部";

const icebreakers = [
  "如果不想尬聊，可以先问：你今天是想快点吃完，还是慢慢吃？",
  "先聊餐厅窗口，再聊今天的课，压力会小很多。",
  "可以从这句开始：我也不太会开场，我们先选吃什么吧。",
  "先确认饭点和座位，再决定要不要继续聊天。",
];

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

export default function Home({ cards, tagOptions, publishedCardId, onCreate, onInvite, onSearch }: HomeProps) {
  const [cardIndex, setCardIndex] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState(ALL_FILTER);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [toast, setToast] = useState("");
  const dragStartRef = useRef<number | null>(null);
  const dragXRef = useRef(0);

  const filterItems = useMemo(
    () => normalizeTags([ALL_FILTER, ...tagOptions.filter((tag) => tag !== ALL_FILTER)]),
    [tagOptions]
  );
  const effectiveFilter = filterItems.includes(activeFilter) ? activeFilter : ALL_FILTER;
  const filteredCards = useMemo(() => {
    if (effectiveFilter === ALL_FILTER) return cards;
    return cards.filter((card) => card.tags.includes(effectiveFilter));
  }, [cards, effectiveFilter]);
  const noCardsForFilter = effectiveFilter !== ALL_FILTER && filteredCards.length === 0;
  const cardPool = filteredCards.length ? filteredCards : cards;
  const currentCard = useMemo(() => cardPool[cardIndex % cardPool.length], [cardIndex, cardPool]);
  const specialCard: SpecialCard = useMemo(() => {
    if (!publishedCardId && swipeCount === 4) return "create";
    if (swipeCount > 0 && swipeCount % 9 === 0) return "ai";
    return "meal";
  }, [publishedCardId, swipeCount]);
  const currentIcebreaker = icebreakers[cardIndex % icebreakers.length];

  const resetSwipe = () => {
    dragStartRef.current = null;
    dragXRef.current = 0;
    setDragStart(null);
    setDragX(0);
  };

  const nextCard = () => {
    setCardIndex((current) => current + 1);
    setSwipeCount((current) => current + 1);
    resetSwipe();
  };

  const invite = () => {
    if (specialCard !== "meal") {
      nextCard();
      return;
    }
    setToast("已发出约饭邀请，正在为你打开消息");
    window.setTimeout(() => onInvite(currentCard), 650);
  };

  const selectFilter = (filter: string) => {
    setActiveFilter(filter);
    setCardIndex(0);
    setSwipeCount(0);
    resetSwipe();
  };

  const startSwipe = (clientX: number) => {
    dragStartRef.current = clientX;
    dragXRef.current = 0;
    setDragStart(clientX);
    setDragX(0);
  };

  const moveSwipe = (clientX: number) => {
    const startX = dragStartRef.current;
    if (startX === null) return;
    const nextX = Math.max(-160, Math.min(160, clientX - startX));
    dragXRef.current = nextX;
    setDragX(nextX);
  };

  const finishSwipe = () => {
    const finalX = dragXRef.current;
    resetSwipe();
    if (finalX < -52) nextCard();
    if (finalX > 52) invite();
  };

  return (
    <div className="app-shell h-[100dvh] overflow-hidden pb-[84px]">
      <div className="relative z-10 h-full">
        <header className="mx-auto max-w-md px-4 pb-2 pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase text-[var(--pine)]">Ueat</p>
              <h1 className="display-cn text-[26px] leading-tight text-[var(--text-main)]">今日饭搭子</h1>
            </div>
            <button
              onClick={onSearch}
              className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(251,253,249,0.82)] text-[var(--text-main)] shadow-sm ring-1 ring-[var(--line-soft)] backdrop-blur-md"
              aria-label="搜索用户、卡片和帖子"
            >
              <Search className="h-[19px] w-[19px]" />
            </button>
          </div>

          <div className="mt-3 rounded-lg bg-[rgba(251,253,249,0.52)] p-2 ring-1 ring-[var(--line-soft)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-black text-[var(--text-muted)]">标签筛选</span>
              <button
                onClick={() => setTagsExpanded((value) => !value)}
                className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-black text-[var(--pine)]"
              >
                {tagsExpanded ? "收起" : "展开"}
                {tagsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div
              className={`flex flex-wrap gap-2 overflow-hidden transition-[max-height] duration-200 ${
                tagsExpanded ? "max-h-[132px] overflow-y-auto pr-1" : "max-h-[78px]"
              }`}
            >
              {filterItems.map((filter) => {
                const isActive = effectiveFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => selectFilter(filter)}
                    className={`flex h-8 shrink-0 items-center rounded-lg px-3 text-[13px] font-bold transition ${
                      isActive
                        ? "bg-[var(--pine)] text-white"
                        : "bg-white/82 text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]"
                    }`}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <main className="mx-auto flex h-[calc(100dvh-272px)] max-w-md flex-col px-4">
          {publishedCardId && (
            <div className="mb-2 flex shrink-0 items-center gap-2 rounded-lg bg-[rgba(209,228,221,0.86)] px-3 py-2 text-[12px] font-bold text-[var(--pine)] ring-1 ring-[var(--line-soft)]">
              <Sparkles className="h-3.5 w-3.5" />
              你的约饭卡已发布，正在被推荐给更合适的同学
            </div>
          )}

          <section
            className="relative min-h-0 flex-1 touch-none select-none"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              startSwipe(event.clientX);
            }}
            onPointerMove={(event) => {
              if (dragStart !== null) moveSwipe(event.clientX);
            }}
            onPointerUp={finishSwipe}
            onPointerCancel={finishSwipe}
            onTouchStart={(event) => startSwipe(event.touches[0]?.clientX ?? 0)}
            onTouchMove={(event) => {
              event.preventDefault();
              moveSwipe(event.touches[0]?.clientX ?? 0);
            }}
            onTouchEnd={finishSwipe}
          >
            <div className="absolute -right-1 top-5 h-[calc(100%-12px)] w-full rounded-lg bg-[rgba(180,207,194,0.66)]" />
            <div className="absolute -left-1 top-2.5 h-[calc(100%-12px)] w-full rounded-lg bg-[rgba(217,154,136,0.22)]" />

            {noCardsForFilter ? (
              <SpecialPromptCard
                dragX={dragX}
                tone="create"
                title={`${effectiveFilter} 暂无卡片`}
                text="这个标签下暂时还没有人发约饭卡。你可以先发布一张，让相同偏好的人更容易看到你。"
                primaryText="发布约饭卡"
                secondaryText="看全部"
                onPrimary={onCreate}
                onSecondary={() => selectFilter(ALL_FILTER)}
              />
            ) : specialCard === "create" ? (
              <SpecialPromptCard
                dragX={dragX}
                tone="create"
                title="还没遇到合适的人？"
                text="创建一张自己的约饭卡，让时间、地点和标签更接近的人主动看到你。"
                primaryText="创建约饭卡"
                secondaryText="继续看看"
                onPrimary={onCreate}
                onSecondary={nextCard}
              />
            ) : specialCard === "ai" ? (
              <SpecialPromptCard
                dragX={dragX}
                tone="ai"
                title="让系统缩小范围"
                text="根据你刚刚跳过的标签，优先推荐更近餐厅、更合适饭点和更相似文本的卡片。"
                primaryText="AI 辅助推荐"
                secondaryText="继续划卡"
                onPrimary={() => setToast("AI 推荐会在后续版本接入")}
                onSecondary={nextCard}
              />
            ) : (
              <MealSwipeCard
                key={currentCard.id}
                card={currentCard}
                dragX={dragX}
                icebreaker={currentIcebreaker}
                onSkip={nextCard}
                onInvite={invite}
              />
            )}
          </section>

          <div className="flex h-7 shrink-0 items-center justify-center gap-3 text-[11px] font-bold text-[rgba(85,105,96,0.68)]">
            <span className="flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              左滑换一个
            </span>
            <span className="h-1 w-1 rounded-full bg-[rgba(85,105,96,0.28)]" />
            <span className="flex items-center gap-1">
              右滑想一起吃
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </main>
      </div>

      {toast && (
        <div className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-lg bg-[var(--pine)] px-4 py-2.5 text-[13px] font-bold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function MealSwipeCard({
  card,
  dragX,
  icebreaker,
  onSkip,
  onInvite,
}: {
  card: MealCard;
  dragX: number;
  icebreaker: string;
  onSkip: () => void;
  onInvite: () => void;
}) {
  return (
    <article
      className="swipe-card meal-card relative flex h-full flex-col rounded-lg p-4"
      style={{ transform: `translateX(${dragX}px) rotate(${dragX / 34}deg)` }}
    >
      <div className="card-content flex shrink-0 items-start justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar text={card.avatarText} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="display-cn truncate text-[21px] text-[#fffdf3]">{card.nickname}</h2>
              {card.verified && <BadgeCheck className="h-4 w-4 fill-[#d5b66f] text-[#365d51]" />}
            </div>
            <p className="text-[12px] font-bold text-[#d8eade]">校园认证 · 今日约饭卡</p>
          </div>
        </div>
        <div className="rounded-lg bg-[rgba(213,182,111,0.24)] px-2.5 py-1 text-[13px] font-black text-[#ffedb8] ring-1 ring-[rgba(255,237,184,0.22)]">
          {card.matchScore}%
        </div>
      </div>

      <p className="card-content mt-4 line-clamp-4 shrink-0 text-[20px] font-black leading-[1.55] text-[#fffdf3]">
        {card.text}
      </p>

      <div className="card-content mt-3 grid shrink-0 grid-cols-3 gap-2">
        <InfoPill icon={<Clock3 />} label={card.time} />
        <InfoPill icon={<MapPin />} label={card.place} />
        <InfoPill icon={<Utensils />} label={card.people} />
      </div>

      <div className="card-content mt-3 rounded-lg border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.12)] px-3.5 py-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-black text-[#ffedb8]">
          <Sparkles className="h-3.5 w-3.5" />
          破冰话题
        </div>
        <p className="line-clamp-2 text-[14px] font-bold leading-5 text-[#fff8e5]">{icebreaker}</p>
      </div>

      <div className="card-content mt-3 flex min-h-0 flex-1 content-start flex-wrap gap-1.5 overflow-hidden">
        {card.tags.slice(0, 7).map((tag) => (
          <span key={tag} className="tag-chip h-7 rounded-lg px-2.5 py-1 text-[12px] font-bold">
            {tag}
          </span>
        ))}
      </div>

      <div className="card-content grid shrink-0 grid-cols-2 gap-2.5 pt-3">
        <button
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onSkip();
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[rgba(255,255,255,0.12)] text-[15px] font-black text-[#f8fff8] ring-1 ring-[rgba(255,255,255,0.18)]"
        >
          <RotateCcw className="h-[18px] w-[18px]" />
          换一个
        </button>
        <button
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onInvite();
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#f0d486] text-[15px] font-black text-[#2d463e] shadow-[0_14px_28px_rgba(54,93,81,0.24)]"
        >
          想一起吃
          <ArrowRight className="h-[18px] w-[18px]" />
        </button>
      </div>
    </article>
  );
}

function SpecialPromptCard({
  dragX,
  tone,
  title,
  text,
  primaryText,
  secondaryText,
  onPrimary,
  onSecondary,
}: {
  dragX: number;
  tone: "create" | "ai";
  title: string;
  text: string;
  primaryText: string;
  secondaryText: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const isAi = tone === "ai";

  return (
    <article
      className="swipe-card meal-card relative flex h-full flex-col rounded-lg p-5 text-center"
      style={{ transform: `translateX(${dragX}px) rotate(${dragX / 34}deg)` }}
    >
      <div className="card-content flex flex-1 flex-col items-center justify-center">
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-lg ring-1 ${
            isAi
              ? "bg-[rgba(143,185,199,0.24)] text-[#e6fbff] ring-[rgba(230,251,255,0.22)]"
              : "bg-[rgba(213,182,111,0.22)] text-[#ffedb8] ring-[rgba(255,237,184,0.22)]"
          }`}
        >
          {isAi ? <Sparkles className="h-11 w-11" /> : <span className="text-[44px] font-light">+</span>}
        </div>
        <h2 className="display-cn mt-7 text-[27px] leading-tight text-[#fffdf3]">{title}</h2>
        <p className="mt-3 max-w-[290px] text-[15px] font-bold leading-6 text-[#d8eade]">{text}</p>
      </div>
      <div className="card-content grid shrink-0 grid-cols-2 gap-2.5">
        <button
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onSecondary();
          }}
          className="h-12 rounded-lg bg-[rgba(255,255,255,0.12)] text-[15px] font-black text-white ring-1 ring-[rgba(255,255,255,0.18)]"
        >
          {secondaryText}
        </button>
        <button
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onPrimary();
          }}
          className={`h-12 rounded-lg text-[15px] font-black text-[#2d463e] shadow-[0_12px_26px_rgba(54,93,81,0.24)] ${
            isAi ? "bg-[#bfe2eb]" : "bg-[#f0d486]"
          }`}
        >
          {primaryText}
        </button>
      </div>
    </article>
  );
}

function Avatar({ text }: { text: string }) {
  return (
    <div className="display-cn flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-[19px] text-[#28483f] ring-1 ring-[rgba(255,247,215,0.48)]">
      {text}
    </div>
  );
}

function InfoPill({ icon, label }: { icon: ReactElement; label: string }) {
  return (
    <div className="meta-cell flex min-h-12 flex-col justify-center rounded-lg px-2.5">
      <span className="mb-0.5 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      <span className="truncate text-[12px] font-black">{label}</span>
    </div>
  );
}
