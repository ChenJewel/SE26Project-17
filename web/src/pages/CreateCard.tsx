/**
 * 约饭卡创建页。
 *
 * 用户可以填写约饭文案、选择日期时间、选择或自定义地点、选择或创建标签。
 * 发布后的卡片会回传给 App，进入首页卡片流，同时出现在“我的”的最近创作划卡中。
 */
import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { BadgeCheck, Check, ChevronDown, Clock3, MapPin, Plus, Sparkles, Utensils, X } from "lucide-react";

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
  tagOptions: string[];
  onPublish: (card: MealCard) => void;
  onCancel: () => void;
}

const timeOptions = ["今天中午", "今天 18:30", "今晚有空", "明天午饭"];
const placeOptions = ["随便", "一食堂", "二食堂", "三食堂", "四食堂", "校外", "附近"];
const peopleOptions = ["1 对 1", "2-3 人", "都可以"];
const fallbackTags = [
  "晚饭",
  "午饭",
  "不吃辣",
  "喜欢吃辣",
  "清淡",
  "想尝新",
  "考研党",
  "新生",
  "社恐友好",
  "喜欢安静",
  "可以聊天",
  "运动",
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function defaultDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMealTime(date: string, clock: string, fallback: string) {
  if (!date || !clock) return fallback;
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日 ${clock}`;
}

export default function CreateCard({ tagOptions, onPublish, onCancel }: CreateCardProps) {
  const [nickname, setNickname] = useState("我");
  const [text, setText] = useState("");
  const [time, setTime] = useState("今天 18:30");
  const [mealDate, setMealDate] = useState(defaultDateValue);
  const [mealClock, setMealClock] = useState("18:30");
  const [place, setPlace] = useState("二食堂");
  const [customPlace, setCustomPlace] = useState("");
  const [people, setPeople] = useState("1 对 1");
  const [tags, setTags] = useState<string[]>(["晚饭", "二食堂", "喜欢安静"]);
  const [customTag, setCustomTag] = useState("");

  const selectedPlace = customPlace.trim() || place;
  const selectedTime = formatMealTime(mealDate, mealClock, time);
  const allTagOptions = useMemo(() => uniqueValues([...tagOptions, ...fallbackTags, ...tags]), [tagOptions, tags]);

  const draftCard = useMemo<MealCard>(
    () => ({
      id: `draft-${Date.now()}`,
      nickname: nickname.trim() || "我",
      avatarText: (nickname.trim() || "我").slice(0, 1),
      verified: true,
      text:
        text.trim() ||
        "写下今天想找什么样的饭搭子，比如时间、地点、想吃什么、希望怎么相处。",
      time: selectedTime,
      place: selectedPlace,
      people,
      tags: uniqueValues([...tags, selectedPlace]),
      matchScore: 88,
      reason: "发布后根据标签、时间和地点计算",
    }),
    [nickname, people, selectedPlace, selectedTime, tags, text]
  );

  const isReady = text.trim().length >= 8 && tags.length >= 2 && Boolean(selectedPlace);

  const toggleTag = (tag: string) => {
    setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  };

  const addCustomTag = () => {
    const nextTag = customTag.trim();
    if (!nextTag) return;
    setTags((current) => uniqueValues([...current, nextTag]));
    setCustomTag("");
  };

  const useCustomPlace = () => {
    const nextPlace = customPlace.trim();
    if (!nextPlace) return;
    setPlace(nextPlace);
    setTags((current) => uniqueValues([...current, nextPlace]));
  };

  const publish = () => {
    if (!isReady) return;
    onPublish({
      ...draftCard,
      id: `user-${Date.now()}`,
      reason: `与你的 ${Math.min(draftCard.tags.length, 4)} 个标签相关`,
    });
  };

  return (
    <div className="app-shell min-h-screen pb-32">
      <header className="page-header sticky top-0 z-30">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <button
            onClick={onCancel}
            className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(251,253,249,0.86)] text-[var(--text-main)] shadow-sm ring-1 ring-[var(--line-soft)]"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="display-cn text-[22px] text-[var(--text-main)]">创建约饭卡</h1>
          <div className="h-11 w-11" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-5">
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-sm font-black text-[var(--text-main)]">卡片预览</p>
            <span className="text-xs font-bold text-[var(--text-muted)]">发布后展示在首页和我的</span>
          </div>

          <div className="meal-card rounded-lg p-4">
            <div className="card-content flex items-center gap-3">
              <button className="flex h-14 w-14 items-center justify-center rounded-lg bg-[rgba(213,182,111,0.2)] text-[#ffedb8] ring-1 ring-[rgba(255,237,184,0.24)]">
                <Plus className="h-7 w-7" />
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="display-cn text-[20px] text-[#fffdf3]">{draftCard.nickname}</p>
                  <BadgeCheck className="h-4 w-4 fill-[#d5b66f] text-[#365d51]" />
                </div>
                <p className="text-xs font-bold text-[#d8eade]">校园认证 · 你的约饭卡</p>
              </div>
            </div>

            <p className="card-content mt-5 text-xl font-black leading-[1.5] text-[#fffdf3]">{draftCard.text}</p>

            <div className="card-content mt-4 flex flex-wrap gap-2">
              {draftCard.tags.map((tag) => (
                <span key={tag} className="tag-chip rounded-lg px-3 py-1.5 text-sm font-bold">
                  {tag}
                </span>
              ))}
            </div>

            <div className="card-content mt-4 grid grid-cols-3 gap-2">
              <PreviewMeta icon={<Clock3 />} label={draftCard.time} />
              <PreviewMeta icon={<MapPin />} label={draftCard.place} />
              <PreviewMeta icon={<Utensils />} label={draftCard.people} />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <SectionTitle title="约饭信息" />
          <div className="space-y-4">
            <Field label="昵称">
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="h-12 w-full rounded-lg bg-[rgba(251,253,249,0.86)] px-4 text-sm font-bold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--moss)]"
                placeholder="给卡片显示一个昵称"
              />
            </Field>

            <Field label="约饭文案">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="min-h-28 w-full resize-none rounded-lg bg-[rgba(251,253,249,0.86)] px-4 py-3 text-sm font-bold leading-6 text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--moss)]"
                placeholder="写下今天想找什么样的饭搭子，比如时间、地点、口味、聊天状态。"
              />
            </Field>

            <div>
              <p className="mb-2 text-sm font-black text-[var(--text-main)]">饭点时间</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={mealDate}
                  onChange={(event) => setMealDate(event.target.value)}
                  className="h-12 min-w-0 rounded-lg bg-[rgba(251,253,249,0.86)] px-3 text-sm font-bold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] focus:ring-[var(--moss)]"
                />
                <input
                  type="time"
                  value={mealClock}
                  onChange={(event) => setMealClock(event.target.value)}
                  className="h-12 min-w-0 rounded-lg bg-[rgba(251,253,249,0.86)] px-3 text-sm font-bold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] focus:ring-[var(--moss)]"
                />
              </div>
            </div>

            <ChoiceGroup label="常用饭点" options={timeOptions} value={time} onChange={setTime} />
            <ChoiceGroup label="约饭地点" options={placeOptions} value={place} onChange={setPlace} />

            <div>
              <p className="mb-2 text-sm font-black text-[var(--text-main)]">自定义地点</p>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={customPlace}
                  onChange={(event) => setCustomPlace(event.target.value)}
                  className="h-12 min-w-0 rounded-lg bg-[rgba(251,253,249,0.86)] px-4 text-sm font-bold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--moss)]"
                  placeholder="随便、校外餐厅、附近商圈..."
                />
                <button onClick={useCustomPlace} className="h-12 rounded-lg bg-[var(--pine)] px-4 text-sm font-black text-white">
                  使用
                </button>
              </div>
            </div>

            <ChoiceGroup label="人数偏好" options={peopleOptions} value={people} onChange={setPeople} />
          </div>
        </section>

        <section className="mt-6">
          <SectionTitle title="标签" action="至少选择 2 个，也可以自己创建" />
          <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
            <input
              value={customTag}
              onChange={(event) => setCustomTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addCustomTag();
              }}
              className="h-11 min-w-0 rounded-lg bg-[rgba(251,253,249,0.86)] px-4 text-sm font-bold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--moss)]"
              placeholder="创建新标签，比如：摄影、赶 ddl、INFJ"
            />
            <button onClick={addCustomTag} className="h-11 rounded-lg bg-[var(--pine)] px-4 text-sm font-black text-white">
              添加
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allTagOptions.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-black transition ${
                    selected
                      ? "bg-[var(--pine)] text-white"
                      : "bg-[rgba(251,253,249,0.82)] text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]"
                  }`}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                  {tag}
                </button>
              );
            })}
          </div>
        </section>

        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(213,182,111,0.42)] bg-[rgba(255,247,215,0.72)] px-4 py-4 text-sm font-black text-[#7b663b]">
          <Sparkles className="h-4 w-4" />
          自动生成约饭文案
          <ChevronDown className="h-4 w-4" />
        </button>
      </main>

      <div className="fixed inset-x-0 bottom-[74px] z-30 border-t border-[var(--line-soft)] bg-[rgba(251,253,249,0.9)] px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto max-w-md">
          <button
            onClick={publish}
            disabled={!isReady}
            className={`h-14 w-full rounded-lg text-base font-black transition ${
              isReady
                ? "bg-[var(--pine)] text-white shadow-[0_12px_28px_rgba(90,130,114,0.26)]"
                : "bg-[rgba(180,207,194,0.62)] text-[rgba(102,121,112,0.72)]"
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
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="text-base font-black text-[var(--text-main)]">{title}</h2>
      {action && <span className="text-xs font-bold text-[var(--text-muted)]">{action}</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--text-main)]">{label}</span>
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
    <div>
      <p className="mb-2 text-sm font-black text-[var(--text-main)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-lg px-3 py-2 text-sm font-black transition ${
              value === option
                ? "bg-[var(--pine)] text-white"
                : "bg-[rgba(251,253,249,0.82)] text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewMeta({ icon, label }: { icon: ReactElement; label: string }) {
  return (
    <div className="meta-cell flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-center">
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="max-w-full px-1 text-[11px] font-black">{label}</span>
    </div>
  );
}
