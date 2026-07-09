import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Clock3,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Utensils,
} from "lucide-react";
import type { MealCard } from "@/pages/CreateCard";

interface HomeProps {
  cards: MealCard[];
  publishedCardId: string | null;
  onCreate: () => void;
  onInvite: (card: MealCard) => void;
}

type SpecialCard = "meal" | "create" | "ai";

const filters = ["今晚", "同食堂", "不吃辣", "安静", "考研党", "筛选"];

const icebreakers = [
  "如果不想尬聊，可以先问：你今天是想快点吃完，还是慢慢吃？",
  "破冰建议：先聊食堂窗口，再聊今天的课，压力会小很多。",
  "可以从这句开始：我也不太会开场，我们先选吃什么吧。",
  "系统建议：先确认饭点和座位，再决定要不要继续聊天。",
];

export default function Home({ cards, publishedCardId, onCreate, onInvite }: HomeProps) {
  const [cardIndex, setCardIndex] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState("今晚");
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [toast, setToast] = useState("");

  const currentCard = useMemo(() => cards[cardIndex % cards.length], [cards, cardIndex]);
  const specialCard: SpecialCard = useMemo(() => {
    if (!publishedCardId && swipeCount === 4) return "create";
    if (swipeCount > 0 && swipeCount % 9 === 0) return "ai";
    return "meal";
  }, [publishedCardId, swipeCount]);
  const currentIcebreaker = icebreakers[cardIndex % icebreakers.length];

  const nextCard = () => {
    setCardIndex((current) => current + 1);
    setSwipeCount((current) => current + 1);
    setDragX(0);
  };

  const invite = () => {
    if (specialCard !== "meal") {
      nextCard();
      return;
    }
    setToast("已发出约饭邀请，等待对方确认");
    window.setTimeout(() => onInvite(currentCard), 650);
  };

  const handlePointerUp = () => {
    if (dragX > 92) {
      invite();
    } else if (dragX < -92) {
      nextCard();
    }
    setDragStart(null);
    setDragX(0);
  };

  return (
    <div className="forest-soft-shell h-[100dvh] pb-[84px]">
      <div className="relative z-10 h-full">
        <header className="mx-auto max-w-md px-4 pb-2 pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-semibold text-[var(--mist-tea-deep)]">Ueat</p>
              <h1 className="text-[22px] font-semibold text-[var(--mist-text)]">今日饭搭子</h1>
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(251,250,245,0.76)] text-[var(--mist-text)] shadow-sm ring-1 ring-[var(--mist-line)] backdrop-blur-md">
              <Search className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {filters.map((filter) => {
              const isFilterButton = filter === "筛选";
              const isActive = activeFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => !isFilterButton && setActiveFilter(filter)}
                  className={`flex h-8 shrink-0 items-center gap-1 rounded-xl px-3 text-[13px] font-medium transition ${
                    isActive
                      ? "bg-[var(--mist-tea-deep)] text-[#fbfaf5]"
                      : "bg-[rgba(251,250,245,0.62)] text-[var(--mist-muted)] ring-1 ring-[rgba(217,221,210,0.7)] backdrop-blur-md"
                  }`}
                >
                  {filter}
                  {isFilterButton && <SlidersHorizontal className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </header>

        <main className="mx-auto flex h-[calc(100dvh-176px)] max-w-md flex-col px-4">
          {publishedCardId && (
            <div className="mb-2 flex shrink-0 items-center gap-2 rounded-xl bg-[rgba(226,237,218,0.76)] px-3 py-2 text-[12px] font-medium text-[var(--mist-tea-deep)] ring-1 ring-[rgba(163,184,154,0.42)] backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" />
              你的约饭卡已发布，正在被推荐给更合适的同学
            </div>
          )}

          <section
            className="relative min-h-0 flex-1"
            onPointerDown={(event) => setDragStart(event.clientX)}
            onPointerMove={(event) => {
              if (dragStart !== null) setDragX(event.clientX - dragStart);
            }}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="card-depth-back card-depth-back-primary absolute -right-1.5 top-5 h-[calc(100%-10px)] w-full rounded-2xl bg-[rgba(180,199,184,0.52)] blur-[0.2px]" />
            <div className="card-depth-back card-depth-back-secondary absolute -left-1.5 top-2.5 h-[calc(100%-10px)] w-full rounded-2xl bg-[rgba(216,170,168,0.34)] blur-[0.2px]" />

            <div className={`card-float-frame h-full ${dragStart !== null || dragX !== 0 ? "is-dragging" : ""}`}>
              {specialCard === "create" ? (
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
                  title="要不要让系统缩小范围？"
                  text="后期可以根据你刚刚跳过的标签，优先推荐更近食堂、更合适饭点和更相似文本的卡片。"
                  primaryText="AI 辅助推荐"
                  secondaryText="继续划卡"
                  onPrimary={() => setToast("AI 推荐会在后续版本接入")}
                  onSecondary={nextCard}
                />
              ) : (
                <MealSwipeCard
                  card={currentCard}
                  dragX={dragX}
                  icebreaker={currentIcebreaker}
                  onSkip={nextCard}
                  onInvite={invite}
                />
              )}
            </div>
          </section>

          <div className="flex h-7 shrink-0 items-center justify-center gap-3 text-[11px] font-medium text-[rgba(85,102,94,0.68)]">
            <span className="flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              左滑换一个
            </span>
            <span className="h-1 w-1 rounded-full bg-[rgba(85,102,94,0.28)]" />
            <span className="flex items-center gap-1">
              右滑想一起吃
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </main>
      </div>

      {toast && (
        <div className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-[var(--mist-tea-deep)] px-4 py-2.5 text-[13px] font-medium text-[#fbfaf5] shadow-xl">
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
      className="swipe-drag-card mist-glass relative flex h-full flex-col rounded-2xl p-4"
      style={{ transform: `translateX(${dragX}px) rotate(${dragX / 34}deg)` }}
    >
      <div className="flex shrink-0 items-start justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar text={card.avatarText} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[18px] font-semibold text-[var(--mist-text)]">{card.nickname}</h2>
              {card.verified && <BadgeCheck className="h-4 w-4 fill-[var(--mist-tea)] text-[#fbfaf5]" />}
            </div>
            <p className="text-[12px] font-medium text-[var(--mist-muted)]">校园认证 · 今日约饭卡</p>
          </div>
        </div>
        <div className="rounded-xl bg-[rgba(226,237,218,0.88)] px-2.5 py-1 text-[13px] font-semibold text-[var(--mist-tea-deep)] ring-1 ring-[rgba(163,184,154,0.42)]">
          {card.matchScore}%
        </div>
      </div>

      <p className="mt-4 line-clamp-4 shrink-0 text-[20px] font-medium leading-[1.42] text-[#26312c]">
        {card.text}
      </p>

      <div className="mt-3 grid shrink-0 grid-cols-3 gap-2">
        <InfoPill icon={<Clock3 />} label={card.time} />
        <InfoPill icon={<MapPin />} label={card.place} />
        <InfoPill icon={<Utensils />} label={card.people} />
      </div>

      <div className="mt-3 rounded-xl bg-[rgba(246,232,210,0.72)] px-3.5 py-3 ring-1 ring-[rgba(200,169,107,0.34)]">
        <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#8b7448]">
          <Sparkles className="h-3.5 w-3.5" />
          系统破冰话题
        </div>
        <p className="line-clamp-2 text-[14px] font-medium leading-5 text-[#55493c]">{icebreaker}</p>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 content-start flex-wrap gap-1.5 overflow-hidden">
        {card.tags.slice(0, 7).map((tag) => (
          <span
            key={tag}
            className="h-7 rounded-xl bg-[rgba(232,238,229,0.78)] px-2.5 py-1 text-[12px] font-medium text-[var(--mist-tea-deep)] ring-1 ring-[rgba(201,213,197,0.58)]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2.5 pt-3">
        <button
          onClick={onSkip}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[rgba(244,241,234,0.88)] text-[15px] font-semibold text-[#657168] ring-1 ring-[rgba(217,221,210,0.7)]"
        >
          <RotateCcw className="h-[18px] w-[18px]" />
          换一个
        </button>
        <button
          onClick={onInvite}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--mist-tea-deep)] text-[15px] font-semibold text-[#fbfaf5] shadow-[0_12px_28px_rgba(79,112,93,0.22)]"
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
      className="swipe-drag-card mist-glass relative flex h-full flex-col rounded-2xl p-5 text-center"
      style={{ transform: `translateX(${dragX}px) rotate(${dragX / 34}deg)` }}
    >
      <div className="flex flex-1 flex-col items-center justify-center">
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-2xl ring-1 ${
            isAi
              ? "bg-[rgba(222,232,239,0.74)] text-[var(--mist-blue)] ring-[rgba(120,148,163,0.28)]"
              : "bg-[rgba(226,237,218,0.78)] text-[var(--mist-tea-deep)] ring-[rgba(163,184,154,0.34)]"
          }`}
        >
          {isAi ? <Sparkles className="h-11 w-11" /> : <span className="text-[44px] font-light">+</span>}
        </div>
        <h2 className="mt-7 text-[25px] font-semibold leading-tight text-[var(--mist-text)]">{title}</h2>
        <p className="mt-3 max-w-[290px] text-[15px] leading-6 text-[var(--mist-muted)]">{text}</p>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2.5">
        <button
          onClick={onSecondary}
          className="h-12 rounded-xl bg-[rgba(244,241,234,0.88)] text-[15px] font-semibold text-[#657168] ring-1 ring-[rgba(217,221,210,0.7)]"
        >
          {secondaryText}
        </button>
        <button
          onClick={onPrimary}
          className={`h-12 rounded-xl text-[15px] font-semibold text-[#fbfaf5] shadow-[0_12px_28px_rgba(79,112,93,0.2)] ${
            isAi ? "bg-[var(--mist-blue)]" : "bg-[var(--mist-tea-deep)]"
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
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[rgba(221,233,229,0.95)] via-[rgba(226,237,218,0.9)] to-[rgba(241,218,208,0.86)] text-[18px] font-semibold text-[var(--mist-tea-deep)] ring-1 ring-[rgba(217,221,210,0.62)]">
      {text}
    </div>
  );
}

function InfoPill({ icon, label }: { icon: React.ReactElement; label: string }) {
  return (
    <div className="flex min-h-12 flex-col justify-center rounded-xl bg-[rgba(244,241,234,0.7)] px-2.5 text-[#5c6861] ring-1 ring-[rgba(217,221,210,0.58)]">
      <span className="mb-0.5 text-[var(--mist-tea-deep)] [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      <span className="truncate text-[12px] font-semibold">{label}</span>
    </div>
  );
}
