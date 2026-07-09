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

const filters = ["今晚有空", "同食堂", "不吃辣", "安静吃饭", "考研党", "社恐友好"];

export default function Home({ cards, publishedCardId, onCreate, onInvite }: HomeProps) {
  const [cardIndex, setCardIndex] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState("今晚有空");
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [toast, setToast] = useState("");

  const currentCard = useMemo(() => cards[cardIndex % cards.length], [cards, cardIndex]);
  const showCreatePrompt = skippedCount >= 3 && !publishedCardId;

  const nextCard = () => {
    setCardIndex((current) => current + 1);
    setSkippedCount((current) => current + 1);
    setDragX(0);
  };

  const invite = () => {
    setToast("已发出约饭邀请，等待对方确认");
    window.setTimeout(() => onInvite(currentCard), 650);
  };

  const handlePointerUp = () => {
    if (dragX > 90) {
      invite();
    } else if (dragX < -90) {
      nextCard();
    }
    setDragStart(null);
    setDragX(0);
  };

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-[#f5f7f2]/88 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-emerald-700">Ueat</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">今日饭搭子</h1>
            </div>
            <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm ring-1 ring-slate-200">
              <Search className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeFilter === filter
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-white text-slate-500 ring-1 ring-slate-200"
                }`}
              >
                {filter}
              </button>
            ))}
            <button className="flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-500 ring-1 ring-slate-200">
              筛选
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-5">
        {publishedCardId && (
          <div className="mb-4 rounded-[24px] bg-emerald-700 px-5 py-4 text-white shadow-lg shadow-emerald-900/10">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">你的约饭卡已发布</p>
                <p className="mt-1 text-xs leading-5 text-emerald-50">
                  系统会把它推荐给时间、地点和标签更接近的同学。
                </p>
              </div>
            </div>
          </div>
        )}

        {showCreatePrompt ? (
          <CreatePrompt onCreate={onCreate} />
        ) : (
          <section
            className="relative"
            onPointerDown={(event) => setDragStart(event.clientX)}
            onPointerMove={(event) => {
              if (dragStart !== null) setDragX(event.clientX - dragStart);
            }}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="absolute -right-2 top-7 h-[560px] w-full rounded-[34px] bg-emerald-100/70" />
            <div className="absolute -left-2 top-4 h-[560px] w-full rounded-[34px] bg-orange-100/80" />
            <article
              className="relative rounded-[34px] bg-white p-5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 transition-transform"
              style={{
                transform: `translateX(${dragX}px) rotate(${dragX / 26}deg)`,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar text={currentCard.avatarText} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-lg font-bold text-slate-950">{currentCard.nickname}</h2>
                      {currentCard.verified && <BadgeCheck className="h-4 w-4 fill-emerald-600 text-white" />}
                    </div>
                    <p className="text-xs font-medium text-slate-400">校园认证 · 约饭卡</p>
                  </div>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
                  {currentCard.matchScore}%
                </div>
              </div>

              <p className="mt-6 text-[24px] font-bold leading-[1.28] tracking-tight text-slate-950">
                {currentCard.text}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <InfoPill icon={<Clock3 className="h-4 w-4" />} label={currentCard.time} />
                <InfoPill icon={<MapPin className="h-4 w-4" />} label={currentCard.place} />
                <InfoPill icon={<Utensils className="h-4 w-4" />} label={currentCard.people} />
                <InfoPill icon={<Sparkles className="h-4 w-4" />} label={currentCard.reason} wide />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {currentCard.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#edf4e8] px-3 py-1.5 text-sm font-medium text-emerald-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-6 rounded-[24px] bg-slate-950 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-300">匹配度说明</p>
                    <p className="mt-1 text-sm font-semibold">{currentCard.reason}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-white/10 p-1">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-500 text-sm font-black">
                      {currentCard.matchScore}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={nextCard}
                  className="flex h-14 items-center justify-center gap-2 rounded-full bg-slate-100 text-base font-bold text-slate-700"
                >
                  <RotateCcw className="h-5 w-5" />
                  换一个
                </button>
                <button
                  onClick={invite}
                  className="flex h-14 items-center justify-center gap-2 rounded-full bg-emerald-700 text-base font-bold text-white shadow-lg shadow-emerald-900/20"
                >
                  想一起吃
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </article>

            <div className="mt-4 flex items-center justify-center gap-4 text-xs font-medium text-slate-400">
              <span className="flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                左滑换一个
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1">
                右滑想一起吃
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </section>
        )}
      </main>

      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function Avatar({ text }: { text: string }) {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-200 to-orange-100 text-xl font-black text-emerald-900">
      {text}
    </div>
  );
}

function InfoPill({
  icon,
  label,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex min-h-12 items-center gap-2 rounded-2xl bg-slate-50 px-3 text-sm font-semibold text-slate-700 ${
        wide ? "col-span-2" : ""
      }`}
    >
      <span className="text-emerald-700">{icon}</span>
      <span className="line-clamp-1">{label}</span>
    </div>
  );
}

function CreatePrompt({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-[34px] border border-dashed border-emerald-300 bg-white p-6 text-center shadow-xl shadow-slate-900/8">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <Sparkles className="h-9 w-9" />
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">还没遇到合适的人？</h2>
      <p className="mx-auto mt-3 max-w-[300px] text-sm leading-6 text-slate-500">
        创建一张今日约饭卡，让时间、地点和标签更合适的同学来找你。
      </p>
      <button
        onClick={onCreate}
        className="mt-7 h-14 w-full rounded-full bg-emerald-700 text-base font-bold text-white shadow-lg shadow-emerald-900/20"
      >
        创建我的约饭卡
      </button>
    </section>
  );
}
