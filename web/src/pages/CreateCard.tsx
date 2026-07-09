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
    <div className="min-h-screen bg-[#f5f7f2] pb-32">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-[#f5f7f2]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <button
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-black tracking-tight text-slate-950">创建约饭卡</h1>
          <div className="h-10 w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-5">
        <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-slate-900/8 ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-950">卡片预览</p>
            <span className="text-xs font-medium text-slate-400">发布后将在首页展示</span>
          </div>

          <div className="rounded-[30px] border border-dashed border-emerald-300 bg-gradient-to-br from-white to-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <button className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Plus className="h-7 w-7" />
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-950">{draftCard.nickname}</p>
                  <BadgeCheck className="h-4 w-4 fill-emerald-600 text-white" />
                </div>
                <p className="text-xs font-medium text-slate-400">校园认证 · 你的约饭卡</p>
              </div>
            </div>

            <p className="mt-5 text-xl font-black leading-[1.32] tracking-tight text-slate-950">
              {draftCard.text}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {draftCard.tags.length ? (
                draftCard.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-400">
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
          <div className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <Field label="昵称">
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="h-12 w-full rounded-2xl bg-slate-50 px-4 text-sm font-medium outline-none ring-1 ring-slate-100 focus:ring-emerald-300"
                placeholder="给你的卡片显示一个昵称"
              />
            </Field>

            <Field label="约饭文案">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="min-h-28 w-full resize-none rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium leading-6 outline-none ring-1 ring-slate-100 focus:ring-emerald-300"
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
          <div className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap gap-2">
              {tagOptions.map((tag) => {
                const selected = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
                      selected
                        ? "bg-emerald-700 text-white"
                        : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
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

        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-800">
          <Sparkles className="h-4 w-4" />
          自动生成约饭文案
          <ChevronDown className="h-4 w-4" />
        </button>
      </main>

      <div className="fixed inset-x-0 bottom-[74px] z-30 border-t border-slate-200/70 bg-white/94 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto max-w-md">
          <button
            onClick={publish}
            disabled={!isReady}
            className={`h-14 w-full rounded-full text-base font-black transition ${
              isReady
                ? "bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"
                : "bg-slate-200 text-slate-400"
            }`}
          >
            发布约饭卡
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-base font-black text-slate-950">{title}</h2>
      {action && <span className="text-xs font-medium text-slate-400">{action}</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block last:mb-0">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
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
      <p className="mb-2 text-sm font-bold text-slate-700">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
              value === option
                ? "bg-slate-950 text-white"
                : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
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
    <div className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl bg-white text-center ring-1 ring-slate-100">
      <span className="text-emerald-700 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="max-w-full px-1 text-[11px] font-bold text-slate-600">{label}</span>
    </div>
  );
}
