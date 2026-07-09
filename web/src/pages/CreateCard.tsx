import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  Clock3,
  MapPin,
  Plus,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";

export interface MealCard {
  id: string;
  nickname: string;
  avatarText: string;
  verified: boolean;
  text: string;
  time: string;
  place: string;
  people: string;
  tags: string[];
  matchScore: number;
  reason: string;
}

interface CreateCardProps {
  onPublish: (card: MealCard) => void;
  onCancel: () => void;
}

const timeOptions = ["今天中午", "今天 18:30", "今晚有空", "明天午饭"];
const placeOptions = ["一食堂", "二食堂", "三食堂", "四食堂", "校外"];
const peopleOptions = ["1 对 1", "2-3 人", "都可以"];
const tagOptions = [
  "不吃辣",
  "能吃辣",
  "清淡",
  "想尝新",
  "考研党",
  "赶 ddl",
  "社恐友好",
  "安静一点",
  "可以聊天",
  "慢热",
  "电影",
  "MBTI",
];

export default function CreateCard({ onPublish, onCancel }: CreateCardProps) {
  const [nickname, setNickname] = useState("你");
  const [text, setText] = useState("");
  const [time, setTime] = useState("今天 18:30");
  const [place, setPlace] = useState("二食堂");
  const [people, setPeople] = useState("1 对 1");
  const [tags, setTags] = useState<string[]>(["晚饭", "二食堂", "安静一点"]);

  const draftCard = useMemo<MealCard>(
    () => ({
      id: `draft-${Date.now()}`,
      nickname: nickname.trim() || "你",
      avatarText: (nickname.trim() || "你").slice(0, 1),
      verified: true,
      text:
        text.trim() ||
        "点击写下今天想找什么样的饭搭子，例如时间、地点、想吃什么、希望怎么相处。",
      time,
      place,
      people,
      tags,
      matchScore: 86,
      reason: "发布后根据标签、时间和地点计算",
    }),
    [nickname, people, place, tags, text, time]
  );

  const isReady = text.trim().length >= 8 && tags.length >= 2;

  const toggleTag = (tag: string) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const publish = () => {
    if (!isReady) return;
    onPublish({
      ...draftCard,
      id: `user-${Date.now()}`,
      reason: `与你的 ${Math.min(tags.length, 4)} 个标签相关`,
    });
  };

  return (
    <div className="forest-soft-shell min-h-screen pb-32">
      <div className="relative z-10">
        <header className="sticky top-0 z-30 border-b border-[rgba(217,221,210,0.62)] bg-[rgba(237,242,234,0.72)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
            <button
              onClick={onCancel}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(251,250,245,0.76)] text-[var(--mist-text)] shadow-sm ring-1 ring-[var(--mist-line)]"
            >
              <X className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-black text-[var(--mist-text)]">创建约饭卡</h1>
            <div className="h-10 w-10" />
          </div>
        </header>

        <main className="mx-auto max-w-md px-5 pt-5">
          <section className="mist-glass rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-[var(--mist-text)]">卡片预览</p>
              <span className="text-xs font-medium text-[var(--mist-muted)]">发布后将在首页展示</span>
            </div>

            <div className="rounded-2xl border border-dashed border-[rgba(111,143,117,0.5)] bg-[rgba(251,250,245,0.58)] p-4">
              <div className="flex items-center gap-3">
                <button className="flex h-14 w-14 items-center justify-center rounded-xl bg-[rgba(226,237,218,0.78)] text-[var(--mist-tea-deep)] ring-1 ring-[rgba(163,184,154,0.4)]">
                  <Plus className="h-7 w-7" />
                </button>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-[var(--mist-text)]">{draftCard.nickname}</p>
                    <BadgeCheck className="h-4 w-4 fill-[var(--mist-tea)] text-[#fbfaf5]" />
                  </div>
                  <p className="text-xs font-medium text-[var(--mist-muted)]">校园认证 · 你的约饭卡</p>
                </div>
              </div>

              <p className="mt-5 text-xl font-semibold leading-[1.38] text-[var(--mist-text)]">
                {draftCard.text}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {draftCard.tags.length ? (
                  draftCard.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-xl bg-[rgba(232,238,229,0.78)] px-3 py-1.5 text-sm font-semibold text-[var(--mist-tea-deep)] ring-1 ring-[rgba(201,213,197,0.58)]"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="rounded-xl border border-dashed border-[var(--mist-line)] px-3 py-1.5 text-sm font-medium text-[var(--mist-muted)]">
                    + 添加标签
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <PreviewMeta icon={<Clock3 />} label={draftCard.time} />
                <PreviewMeta icon={<MapPin />} label={draftCard.place} />
                <PreviewMeta icon={<Utensils />} label={draftCard.people} />
              </div>
            </div>
          </section>

          <section className="mt-5">
            <SectionTitle title="约饭信息" />
            <div className="mist-glass rounded-2xl p-4">
              <Field label="昵称">
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  className="h-12 w-full rounded-xl bg-[rgba(244,241,234,0.7)] px-4 text-sm font-medium text-[var(--mist-text)] outline-none ring-1 ring-[rgba(217,221,210,0.58)] placeholder:text-[rgba(114,128,120,0.58)] focus:ring-[var(--mist-tea)]"
                  placeholder="给你的卡片显示一个昵称"
                />
              </Field>

              <Field label="约饭文案">
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  className="min-h-28 w-full resize-none rounded-xl bg-[rgba(244,241,234,0.7)] px-4 py-3 text-sm font-medium leading-6 text-[var(--mist-text)] outline-none ring-1 ring-[rgba(217,221,210,0.58)] placeholder:text-[rgba(114,128,120,0.58)] focus:ring-[var(--mist-tea)]"
                  placeholder="写下今天想找什么样的饭搭子，比如时间、地点、口味、聊天状态。"
                />
              </Field>

              <ChoiceGroup label="饭点时间" options={timeOptions} value={time} onChange={setTime} />
              <ChoiceGroup label="约饭地点" options={placeOptions} value={place} onChange={setPlace} />
              <ChoiceGroup label="人数偏好" options={peopleOptions} value={people} onChange={setPeople} />
            </div>
          </section>

          <section className="mt-5">
            <SectionTitle title="标签" action="后期可继续调整" />
            <div className="mist-glass rounded-2xl p-4">
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        selected
                          ? "bg-[var(--mist-tea-deep)] text-[#fbfaf5]"
                          : "bg-[rgba(244,241,234,0.7)] text-[var(--mist-muted)] ring-1 ring-[rgba(217,221,210,0.58)]"
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(200,169,107,0.36)] bg-[rgba(246,232,210,0.68)] px-4 py-4 text-sm font-bold text-[#8b7448]">
            <Sparkles className="h-4 w-4" />
            自动生成约饭文案
            <ChevronDown className="h-4 w-4" />
          </button>
        </main>

        <div className="fixed inset-x-0 bottom-[74px] z-30 border-t border-[rgba(217,221,210,0.7)] bg-[rgba(251,250,245,0.82)] px-5 py-3 backdrop-blur-xl">
          <div className="mx-auto max-w-md">
            <button
              onClick={publish}
              disabled={!isReady}
              className={`h-14 w-full rounded-xl text-base font-black transition ${
                isReady
                  ? "bg-[var(--mist-tea-deep)] text-[#fbfaf5] shadow-[0_12px_28px_rgba(79,112,93,0.22)]"
                  : "bg-[rgba(217,221,210,0.7)] text-[rgba(114,128,120,0.72)]"
              }`}
            >
              发布约饭卡
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-base font-black text-[var(--mist-text)]">{title}</h2>
      {action && <span className="text-xs font-medium text-[var(--mist-muted)]">{action}</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block last:mb-0">
      <span className="mb-2 block text-sm font-bold text-[var(--mist-text)]">{label}</span>
      {children}
    </label>
  );
}

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 text-sm font-bold text-[var(--mist-text)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              value === option
                ? "bg-[var(--mist-tea-deep)] text-[#fbfaf5]"
                : "bg-[rgba(244,241,234,0.7)] text-[var(--mist-muted)] ring-1 ring-[rgba(217,221,210,0.58)]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewMeta({ icon, label }: { icon: React.ReactElement; label: string }) {
  return (
    <div className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-[rgba(244,241,234,0.72)] text-center ring-1 ring-[rgba(217,221,210,0.58)]">
      <span className="text-[var(--mist-tea-deep)] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="max-w-full px-1 text-[11px] font-bold text-[var(--mist-muted)]">{label}</span>
    </div>
  );
}
