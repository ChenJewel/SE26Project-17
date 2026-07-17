/**
 * 约饭卡创建页。
 *
 * 用户可以填写约饭文案、选择日期时间、选择或自定义地点、选择或创建标签。
 * 发布后的卡片会回传给 App，进入首页卡片流，同时出现在“我的”的最近创作划卡中。
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { BadgeCheck, Check, ChevronDown, Clock3, Eye, Image as ImageIcon, MapPin, Save, Sparkles, Utensils, Video, X } from "lucide-react";
import { uniqueTrimmed } from "@/lib/collections";
import { uploadMedia } from "@/services/uploadApi";
import type { CurrentUser } from "@/types/auth";
import type { MealCard } from "@/types/meal";

interface CreateCardProps {
  currentUser: CurrentUser | null;
  tagOptions: string[];
  selectedTags: string[];
  onTagOptionsChange: (tags: string[]) => void;
  onSelectedTagsChange: (tags: string[]) => void;
  onPublish: (card: MealCard) => Promise<void>;
  onCancel: () => void;
}

const timeOptions = ["今天中午", "今天 18:30", "今晚有空", "明天午饭"];
const placeOptions = ["随便", "一食堂", "二食堂", "三食堂", "四食堂", "校外", "附近"];
const peopleOptions = ["1 对 1", "2-3 人", "都可以"];
const visibilityOptions = ["同校可见", "关注可见", "仅匹配推荐"];
const avatarOptions = ["我", "U", "食", "饭", "约", "🍚", "林", "陈"];
const tagPalette = [
  {
    idle: "bg-[#f5f9f7] text-[#2d584b] ring-[#daede4]",
    selected: "bg-[#daede4] text-[#2d584b] ring-[#daede4]",
    preview: "bg-[rgba(218,237,228,0.54)] text-[#2d584b] ring-white/65",
  },
  {
    idle: "bg-[#eef7f3] text-[#2d584b] ring-[#b4dbca]",
    selected: "bg-[#b4dbca] text-[#2d584b] ring-[#b4dbca]",
    preview: "bg-[rgba(180,219,202,0.48)] text-[#2d584b] ring-white/65",
  },
  {
    idle: "bg-[#edf6f2] text-[#324a36] ring-[#87c1aa]",
    selected: "bg-[#87c1aa] text-[#182718] ring-[#87c1aa]",
    preview: "bg-[rgba(135,193,170,0.42)] text-[#324a36] ring-white/65",
  },
  {
    idle: "bg-[#f6f4ef] text-[#324a36] ring-[#e0dbd0]",
    selected: "bg-[#e0dbd0] text-[#324a36] ring-[#e0dbd0]",
    preview: "bg-[rgba(224,219,208,0.5)] text-[#324a36] ring-white/65",
  },
  {
    idle: "bg-[#f0f3ed] text-[#324a36] ring-[#b9bb9f]",
    selected: "bg-[#b9bb9f] text-[#182718] ring-[#b9bb9f]",
    preview: "bg-[rgba(185,187,159,0.4)] text-[#324a36] ring-white/65",
  },
] as const;

function tagColorClass(index: number, selected: boolean) {
  const palette = tagPalette[index % tagPalette.length];
  return selected ? palette.selected : palette.idle;
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

export default function CreateCard({
  currentUser,
  tagOptions,
  selectedTags,
  onTagOptionsChange,
  onSelectedTagsChange,
  onPublish,
  onCancel,
}: CreateCardProps) {
  const draftStorageKey = `ueat.create-card-draft.${currentUser?.id ?? "guest"}`;
  const [nickname, setNickname] = useState(currentUser?.nickname ?? "我");
  const [text, setText] = useState("");
  const [time, setTime] = useState("今天 18:30");
  const [mealDate, setMealDate] = useState(defaultDateValue);
  const [mealClock, setMealClock] = useState("18:30");
  const [place, setPlace] = useState("二食堂");
  const [customPlace, setCustomPlace] = useState("");
  const [people, setPeople] = useState("1 对 1");
  const [visibility, setVisibility] = useState("同校可见");
  const [tags, setTags] = useState<string[]>(() => selectedTags);
  const [customTag, setCustomTag] = useState("");
  const [avatarText, setAvatarText] = useState(currentUser?.avatarText ?? "我");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [mediaType, setMediaType] = useState<"photo" | "video" | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<"idle" | "submitting" | "success">("idle");
  const [publishError, setPublishError] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(draftStorageKey);
      if (!stored) return;
      const draft = JSON.parse(stored) as Partial<{
        nickname: string;
        text: string;
        time: string;
        mealDate: string;
        mealClock: string;
        place: string;
        customPlace: string;
        people: string;
        visibility: string;
        tags: string[];
        avatarText: string;
        mediaType: "photo" | "video" | null;
      }>;

      if (typeof draft.nickname === "string") setNickname(draft.nickname);
      if (typeof draft.text === "string") setText(draft.text);
      if (typeof draft.time === "string") setTime(draft.time);
      if (typeof draft.mealDate === "string") setMealDate(draft.mealDate);
      if (typeof draft.mealClock === "string") setMealClock(draft.mealClock);
      if (typeof draft.place === "string") setPlace(draft.place);
      if (typeof draft.customPlace === "string") setCustomPlace(draft.customPlace);
      if (typeof draft.people === "string") setPeople(draft.people);
      if (typeof draft.visibility === "string") setVisibility(draft.visibility);
      if (Array.isArray(draft.tags)) {
        const draftTags = draft.tags.filter((tag): tag is string => typeof tag === "string");
        setTags(draftTags);
        onSelectedTagsChange(draftTags);
      }
      if (typeof draft.avatarText === "string") setAvatarText(draft.avatarText);
      if (draft.mediaType === "photo" || draft.mediaType === "video") setMediaType(draft.mediaType);
      setDraftSaved(true);
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    setTags((current) => areSameTags(current, selectedTags) ? current : selectedTags);
  }, [selectedTags]);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  const selectedPlace = customPlace.trim() || place;
  const selectedTime = formatMealTime(mealDate, mealClock, time);
  const allTagOptions = useMemo(() => uniqueTrimmed([...tagOptions, ...tags]), [tagOptions, tags]);

  const draftCard = useMemo<MealCard>(
    () => ({
      id: `draft-${Date.now()}`,
      userId: currentUser?.id,
      nickname: nickname.trim() || "我",
      avatarText,
      avatarUrl: currentUser?.avatarUrl,
      verified: currentUser?.campusVerified ?? true,
      text:
        text.trim() ||
        "写下今天想找什么样的饭搭子，比如时间、地点、想吃什么、希望怎么相处。",
      time: selectedTime,
      place: selectedPlace,
      people,
      tags: uniqueTrimmed([...tags, selectedPlace]),
      matchScore: 88,
      reason: "发布后根据标签、时间和地点计算",
    }),
    [avatarText, currentUser?.avatarUrl, currentUser?.campusVerified, currentUser?.id, nickname, people, selectedPlace, selectedTime, tags, text]
  );

  const isReady = text.trim().length >= 8 && tags.length >= 2 && Boolean(selectedPlace);
  const validationMessage = !text.trim()
    ? "先写一段约饭文案。"
    : text.trim().length < 8
      ? "约饭文案至少 8 个字。"
      : tags.length < 2
        ? "至少选择 2 个标签。"
        : !selectedPlace
          ? "请选择或填写约饭地点。"
          : "";

  const toggleTag = (tag: string) => {
    setSharedTags(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]);
  };

  const setSharedTags = (nextTags: string[]) => {
    const normalizedTags = uniqueTrimmed(nextTags);
    setTags(normalizedTags);
    onSelectedTagsChange(normalizedTags);
  };

  const addCustomTag = () => {
    const nextTag = customTag.trim();
    if (!nextTag) return;
    onTagOptionsChange(uniqueTrimmed([...allTagOptions, nextTag]));
    setSharedTags([...tags, nextTag]);
    setCustomTag("");
  };

  const useCustomPlace = () => {
    const nextPlace = customPlace.trim();
    if (!nextPlace) return;
    onTagOptionsChange(uniqueTrimmed([...allTagOptions, nextPlace]));
    setPlace(nextPlace);
    setSharedTags([...tags, nextPlace]);
  };

  const selectMediaType = (type: "photo" | "video" | null) => {
    setMediaType(type);
    setMediaError("");
    setMediaFile(null);
    setMediaPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  };

  const setMedia = (file: File | null) => {
    setMediaError("");
    if (!file) {
      setMediaFile(null);
      setMediaPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      return;
    }

    const nextType = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "photo" : null;
    if (!nextType) {
      setMediaError("请选择图片或视频文件。");
      return;
    }

    setMediaType(nextType);
    setMediaFile(file);
    setMediaPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };

  const saveDraft = () => {
    window.localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        nickname,
        text,
        time,
        mealDate,
        mealClock,
        place,
        customPlace,
        people,
        visibility,
        tags,
        avatarText,
        mediaType,
      })
    );
    setDraftSaved(true);
    setPublishError("");
  };

  const publish = async () => {
    if (!isReady) {
      setPublishError(validationMessage);
      return;
    }

    setPublishFeedback("submitting");
    setPublishError("");
    try {
      let uploadedMedia: { url: string; mimeType: string } | undefined;
      if (mediaFile && mediaType) {
        const asset = await uploadMedia({
          fileName: mediaFile.name,
          mimeType: mediaFile.type || (mediaType === "video" ? "video/mp4" : "image/jpeg"),
          dataBase64: await fileToBase64(mediaFile),
          purpose: "meal-card",
        });
        uploadedMedia = { url: asset.url, mimeType: asset.mimeType };
      }

      await onPublish({
        ...draftCard,
        id: `card-${currentUser?.id ?? "guest"}-${Date.now()}`,
        userId: currentUser?.id,
        nickname: nickname.trim() || currentUser?.nickname || "我",
        avatarText,
        avatarUrl: currentUser?.avatarUrl,
        verified: currentUser?.campusVerified ?? true,
        mediaType: uploadedMedia ? mediaType ?? undefined : undefined,
        mediaUrl: uploadedMedia?.url,
        mediaMimeType: uploadedMedia?.mimeType,
        createdAt: new Date().toISOString(),
        reason: `与你的 ${Math.min(draftCard.tags.length, 4)} 个标签相关`,
      });
      window.localStorage.removeItem(draftStorageKey);
      setPublishFeedback("success");
    } catch (error) {
      console.warn("Publish meal card failed.", error);
      setPublishFeedback("idle");
      setPublishError("发布失败：云端暂时没有保存成功，请稍后再试。");
    }
  };

  return (
    <div className="app-shell frosted-page-shell min-h-[100dvh]">
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
              <button
                onClick={() => setAvatarPickerOpen(true)}
                className="display-cn flex h-14 w-14 items-center justify-center rounded-lg bg-[rgba(180,219,202,0.28)] text-2xl text-[#daede4] ring-1 ring-[rgba(180,219,202,0.34)]"
                aria-label="选择卡片头像"
              >
                {draftCard.avatarText}
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="display-cn text-[20px] text-[#fffdf3]">{draftCard.nickname}</p>
                  <BadgeCheck className="h-4 w-4 fill-[#87c1aa] text-[#2d584b]" />
                </div>
                <p className="text-xs font-bold text-[#d8eade]">校园认证 · 你的约饭卡</p>
              </div>
            </div>

            {mediaPreviewUrl ? (
              <div className="card-content mt-4 overflow-hidden rounded-lg bg-black/20 ring-1 ring-white/15">
                {mediaType === "video" ? (
                  <video src={mediaPreviewUrl} controls className="h-40 w-full object-cover" />
                ) : (
                  <img src={mediaPreviewUrl} alt="约饭卡媒体预览" className="h-40 w-full object-cover" />
                )}
              </div>
            ) : null}

            <p className="card-content mt-5 text-xl font-black leading-[1.5] text-[#fffdf3]">{draftCard.text}</p>

            <div className="card-content mt-4 flex flex-wrap gap-2">
              {draftCard.tags.map((tag, index) => (
                <span key={tag} className={`rounded-lg px-3 py-1.5 text-sm font-bold ring-1 backdrop-blur-md ${tagPalette[index % tagPalette.length].preview}`}>
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

        {avatarPickerOpen ? (
          <section className="mt-3 rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black text-[var(--text-main)]">选择卡片头像</p>
              <button onClick={() => setAvatarPickerOpen(false)} className="text-sm font-black text-[var(--pine)]">完成</button>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {avatarOptions.map((option) => {
                const selected = avatarText === option;
                return (
                  <button
                    key={option}
                    onClick={() => setAvatarText(option)}
                    className={`display-cn flex h-10 items-center justify-center rounded-lg text-lg font-black ring-1 ${
                      selected
                        ? "bg-[var(--pine)] text-white ring-[var(--pine)]"
                        : "bg-[rgba(244,248,244,0.92)] text-[var(--pine)] ring-[var(--line-soft)]"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-4 rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-black text-[var(--text-main)]">卡片媒体</p>
            {mediaFile ? (
              <button onClick={() => setMedia(null)} className="text-xs font-black text-[var(--coral)]">
                移除
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => selectMediaType(null)}
              className={`h-10 rounded-lg text-sm font-black ring-1 ${
                !mediaType ? "bg-[var(--pine)] text-white ring-[var(--pine)]" : "bg-white text-[var(--text-muted)] ring-[var(--line-soft)]"
              }`}
            >
              不附加
            </button>
            <button
              onClick={() => selectMediaType("photo")}
              className={`flex h-10 items-center justify-center gap-1 rounded-lg text-sm font-black ring-1 ${
                mediaType === "photo" ? "bg-[var(--pine)] text-white ring-[var(--pine)]" : "bg-white text-[var(--text-muted)] ring-[var(--line-soft)]"
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              照片
            </button>
            <button
              onClick={() => selectMediaType("video")}
              className={`flex h-10 items-center justify-center gap-1 rounded-lg text-sm font-black ring-1 ${
                mediaType === "video" ? "bg-[var(--pine)] text-white ring-[var(--pine)]" : "bg-white text-[var(--text-muted)] ring-[var(--line-soft)]"
              }`}
            >
              <Video className="h-4 w-4" />
              视频
            </button>
          </div>
          {mediaType ? (
            <label className="mt-3 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[rgba(174,217,197,0.34)] text-sm font-black text-[var(--moss)]">
              {mediaFile ? "更换媒体" : mediaType === "video" ? "选择视频" : "选择照片"}
              <input
                type="file"
                accept={mediaType === "video" ? "video/*" : "image/*"}
                className="hidden"
                onChange={(event) => {
                  setMedia(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
          {mediaFile ? <p className="mt-2 truncate text-xs font-bold text-[var(--text-muted)]">{mediaFile.name}</p> : null}
          {mediaError ? <p className="mt-2 text-xs font-black text-[var(--coral)]">{mediaError}</p> : null}
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
            <ChoiceGroup label="可见范围" options={visibilityOptions} value={visibility} onChange={setVisibility} />
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={saveDraft}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-white/82 text-sm font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]"
          >
            <Save className="h-4 w-4" />
            保存草稿
          </button>
          <div className="flex h-11 items-center justify-center gap-2 rounded-lg bg-white/82 text-sm font-black text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
            <Eye className="h-4 w-4" />
            {visibility}
          </div>
        </section>
        {draftSaved ? (
          <p className="mt-2 rounded-lg bg-[rgba(174,217,197,0.3)] px-3 py-2 text-center text-xs font-black text-[var(--moss)]">
            草稿已保存在本机，下次进入会自动恢复。
          </p>
        ) : null}

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
            {allTagOptions.map((tag, index) => {
              const selected = tags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-black ring-1 transition ${tagColorClass(index, selected)}`}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                  {tag}
                </button>
              );
            })}
          </div>
        </section>

          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(126,149,112,0.4)] bg-[rgba(185,187,159,0.38)] px-4 py-4 text-sm font-black text-[#324a36]">
          <Sparkles className="h-4 w-4" />
          自动生成约饭文案
          <ChevronDown className="h-4 w-4" />
        </button>
      </main>

      <div className="app-action-bar fixed inset-x-0 z-30 border-t border-[var(--line-soft)] bg-[rgba(251,253,249,0.9)] px-5 pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-md">
          <button
            onClick={publish}
            className={`h-14 w-full rounded-lg text-base font-black transition ${
              isReady
                ? "bg-[var(--pine)] text-white shadow-[0_12px_28px_rgba(90,130,114,0.26)]"
                : "bg-[rgba(180,207,194,0.62)] text-[rgba(102,121,112,0.72)]"
            }`}
          >
            {publishFeedback === "submitting" ? "正在发布到云端..." : publishFeedback === "success" ? "发布成功，正在返回首页" : "发布约饭卡"}
          </button>
          {publishError ? (
            <p className="mt-2 rounded-lg bg-[rgba(217,154,136,0.16)] px-3 py-2 text-center text-xs font-black text-[var(--coral)]">
              {publishError}
            </p>
          ) : null}
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

function areSameTags(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((tag, index) => tag === right[index]);
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
