/**
 * 约饭卡创建页。
 *
 * 用户可以填写约饭文案、选择日期时间、选择或自定义地点、选择或创建标签。
 * 发布后的卡片会回传给 App，进入首页卡片流，同时出现在“我的”的最近创作划卡中。
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { BadgeCheck, Check, ChevronDown, Clock3, Eye, FolderOpen, Image as ImageIcon, MapPin, Save, Sparkles, Trash2, Utensils, X } from "lucide-react";
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
  onTagDelete: (tag: string) => void;
  onPublish: (card: MealCard) => Promise<void>;
  onCancel: () => void;
}

const timeOptions = ["今天中午", "今天 18:30", "今晚有空", "明天午饭"];
const placeOptions = ["随便", "一食堂", "二食堂", "三食堂", "四食堂", "校外", "附近"];
const peopleOptions = ["1 对 1", "2-3 人", "都可以"];
const visibilityOptions = ["同校可见", "关注可见", "仅匹配推荐"];
const avatarOptions = ["我", "U", "食", "饭", "约", "🍚", "林", "陈"];
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

type SavedCardDraft = {
  id: string;
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
  mediaType: "photo" | null;
  mediaFile: File | null;
  mediaPreviewUrl: string;
  mediaCount: number;
  updatedAt: string;
};

type PersistedCardDraft = Omit<SavedCardDraft, "mediaFile" | "mediaPreviewUrl">;

function toRuntimeDraft(draft: Partial<PersistedCardDraft>, index = 0): SavedCardDraft {
  const mediaType = draft.mediaType === "photo" ? draft.mediaType : null;
  return {
    id: typeof draft.id === "string" ? draft.id : `draft-${Date.now()}-${index}`,
    nickname: typeof draft.nickname === "string" ? draft.nickname : "",
    text: typeof draft.text === "string" ? draft.text : "",
    time: typeof draft.time === "string" ? draft.time : "",
    mealDate: typeof draft.mealDate === "string" ? draft.mealDate : defaultDateValue(),
    mealClock: typeof draft.mealClock === "string" ? draft.mealClock : "18:30",
    place: typeof draft.place === "string" ? draft.place : "",
    customPlace: typeof draft.customPlace === "string" ? draft.customPlace : "",
    people: typeof draft.people === "string" ? draft.people : "",
    visibility: typeof draft.visibility === "string" ? draft.visibility : "",
    tags: Array.isArray(draft.tags) ? draft.tags.filter((tag): tag is string => typeof tag === "string") : [],
    avatarText: typeof draft.avatarText === "string" ? draft.avatarText : "",
    mediaType,
    mediaFile: null,
    mediaPreviewUrl: "",
    mediaCount: mediaType && typeof draft.mediaCount === "number" ? draft.mediaCount : mediaType ? 1 : 0,
    updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : new Date().toISOString(),
  };
}

function readSavedCardDrafts(storageKey: string): SavedCardDraft[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Partial<PersistedCardDraft> | Array<Partial<PersistedCardDraft>>;
    const drafts = Array.isArray(parsed) ? parsed : [parsed];
    return drafts.map(toRuntimeDraft).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

function persistSavedCardDrafts(storageKey: string, drafts: SavedCardDraft[]) {
  const payload: PersistedCardDraft[] = drafts.map((draft) => ({
    id: draft.id,
    nickname: draft.nickname,
    text: draft.text,
    time: draft.time,
    mealDate: draft.mealDate,
    mealClock: draft.mealClock,
    place: draft.place,
    customPlace: draft.customPlace,
    people: draft.people,
    visibility: draft.visibility,
    tags: draft.tags,
    avatarText: draft.avatarText,
    mediaType: draft.mediaType,
    mediaCount: draft.mediaCount,
    updatedAt: draft.updatedAt,
  }));
  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

async function inferMealCardMediaMimeType(file: File) {
  const mimeType = inferMealCardMediaMimeTypeFromMetadata(file);
  if (mimeType) return mimeType;
  return sniffMealCardMediaMimeType(file);
}

function inferMealCardMediaMimeTypeFromMetadata(file: File) {
  const declaredType = file.type.trim().toLowerCase();
  if (declaredType && declaredType !== "application/octet-stream") {
    if (declaredType === "image/jpg" || declaredType === "image/pjpeg") return "image/jpeg";
    if (declaredType === "video/mov") return "video/quicktime";
    return declaredType;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeByExtension: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    qt: "video/quicktime",
    webm: "video/webm",
    "3gp": "video/3gpp",
    "3gpp": "video/3gpp",
  };

  return mimeByExtension[extension] ?? "";
}

async function sniffMealCardMediaMimeType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii.slice(1, 4) === "PNG") return "image/png";
  if (ascii.startsWith("GIF8")) return "image/gif";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (ascii.slice(4, 8) === "ftyp") {
    const brand = ascii.slice(8, 16).toLowerCase();
    if (/heic|heix|hevc|hevx|mif1|msf1/.test(brand)) return "image/heic";
    if (brand.includes("qt  ")) return "video/quicktime";
    return "video/mp4";
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  return "";
}

function mealCardExtensionForMimeType(mimeType: string) {
  const extensionByMimeType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/3gpp": "3gp",
  };

  return extensionByMimeType[mimeType] ?? "jpg";
}

function mealCardUploadFileName(file: File, mimeType: string) {
  const fileName = file.name.trim();
  if (fileName) return fileName;
  return `meal-card-${Date.now()}.${mealCardExtensionForMimeType(mimeType)}`;
}

export default function CreateCard({
  currentUser,
  tagOptions,
  selectedTags,
  onTagOptionsChange,
  onSelectedTagsChange,
  onTagDelete,
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
  const [tagDeleteMode, setTagDeleteMode] = useState(false);
  const [tagDeleteTargets, setTagDeleteTargets] = useState<string[]>([]);
  const [avatarText, setAvatarText] = useState(currentUser?.avatarText ?? "我");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [mediaType, setMediaType] = useState<"photo" | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<SavedCardDraft[]>(() => readSavedCardDrafts(draftStorageKey));
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<"idle" | "submitting" | "success">("idle");
  const [publishError, setPublishError] = useState("");

  const applyDraft = (draft: SavedCardDraft) => {
    setNickname(draft.nickname || currentUser?.nickname || "?");
    setText(draft.text);
    setTime(draft.time || "?? 18:30");
    setMealDate(draft.mealDate || defaultDateValue());
    setMealClock(draft.mealClock || "18:30");
    setPlace(draft.place || "二食堂");
    setCustomPlace(draft.customPlace);
    setPeople(draft.people || "1 ? 1");
    setVisibility(draft.visibility || "同校可见");
    setTags(draft.tags);
    onSelectedTagsChange(draft.tags);
    setAvatarText(draft.avatarText || currentUser?.avatarText || "?");
    setMediaType(draft.mediaType);
    setMediaFile(draft.mediaFile);
    setMediaPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return draft.mediaFile ? URL.createObjectURL(draft.mediaFile) : "";
    });
    setMediaError(draft.mediaCount && !draft.mediaFile ? "浏览器不能恢复上次选择的本地照片，请重新选择图片。" : "");
    setActiveDraftId(draft.id);
    setDraftSaved(true);
  };

  const updateSavedDrafts = (updater: (drafts: SavedCardDraft[]) => SavedCardDraft[]) => {
    setSavedDrafts((current) => {
      const next = updater(current);
      persistSavedCardDrafts(draftStorageKey, next);
      return next;
    });
  };

  useEffect(() => {
    const drafts = readSavedCardDrafts(draftStorageKey);
    setSavedDrafts(drafts);
    if (drafts[0]) applyDraft(drafts[0]);
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
    if (tagDeleteMode) {
      setTagDeleteTargets((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
      return;
    }
    setSharedTags(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]);
  };

  const handleDeleteTags = () => {
    if (!tagDeleteMode) {
      setTagDeleteMode(true);
      setTagDeleteTargets([]);
      return;
    }
    if (!tagDeleteTargets.length) {
      setTagDeleteMode(false);
      return;
    }
    const targets = new Set(tagDeleteTargets);
    tagDeleteTargets.forEach(onTagDelete);
    onTagOptionsChange(allTagOptions.filter((item) => !targets.has(item)));
    setSharedTags(tags.filter((item) => !targets.has(item)));
    setTagDeleteTargets([]);
    setTagDeleteMode(false);
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

  const selectMediaType = (type: "photo" | null) => {
    setMediaType(type);
    setMediaError("");
    setMediaFile(null);
    setMediaPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  };

  const setMedia = async (file: File | null) => {
    setMediaError("");
    if (!file) {
      setMediaFile(null);
      setMediaPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      return;
    }

    const mimeType = await inferMealCardMediaMimeType(file);
    const nextType = mimeType.startsWith("image/") ? "photo" : null;
    if (!nextType) {
      setMediaError("约饭卡只能选择照片，暂不支持视频。");
      return;
    }

    setMediaType(nextType);
    setMediaFile(file);
    setMediaPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };

  const buildCurrentDraft = (): SavedCardDraft => ({
    id: activeDraftId ?? `draft-${Date.now()}`,
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
    mediaFile,
    mediaPreviewUrl: mediaPreviewUrl && mediaFile ? URL.createObjectURL(mediaFile) : "",
    mediaCount: mediaFile ? 1 : mediaType ? 1 : 0,
    updatedAt: new Date().toISOString(),
  });

  const saveDraft = () => {
    const nextDraft = buildCurrentDraft();
    updateSavedDrafts((current) => {
      const oldDraft = current.find((draft) => draft.id === nextDraft.id);
      if (oldDraft?.mediaPreviewUrl) URL.revokeObjectURL(oldDraft.mediaPreviewUrl);
      return [nextDraft, ...current.filter((draft) => draft.id !== nextDraft.id)].slice(0, 20);
    });
    setActiveDraftId(nextDraft.id);
    setDraftSaved(true);
    setPublishError("");
  };

  const loadDraft = (draft: SavedCardDraft) => {
    applyDraft(draft);
    setDraftsOpen(false);
    setPublishError("");
  };

  const deleteDraft = (draftId: string) => {
    updateSavedDrafts((current) => {
      const draft = current.find((item) => item.id === draftId);
      if (draft?.mediaPreviewUrl) URL.revokeObjectURL(draft.mediaPreviewUrl);
      return current.filter((item) => item.id !== draftId);
    });
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
      setDraftSaved(false);
    }
  };

  const publish = async () => {
    if (!isReady) {
      setPublishError(validationMessage);
      return;
    }

    setPublishFeedback("submitting");
    setPublishError("");
    try {
      let uploadedMedia: { url: string; mimeType: string; type: "photo" } | undefined;
      if (mediaFile) {
        const mimeType = (await inferMealCardMediaMimeType(mediaFile)) || "image/jpeg";
        if (!mimeType.startsWith("image/")) {
          setPublishFeedback("idle");
          setPublishError("约饭卡只能选择照片，不能添加视频。");
          return;
        }
        const asset = await uploadMedia({
          fileName: mealCardUploadFileName(mediaFile, mimeType),
          mimeType,
          dataBase64: await fileToBase64(mediaFile),
          purpose: "meal-card",
        });
        uploadedMedia = { url: asset.url, mimeType: asset.mimeType, type: "photo" };
      }

      await onPublish({
        ...draftCard,
        id: `card-${currentUser?.id ?? "guest"}-${Date.now()}`,
        userId: currentUser?.id,
        nickname: nickname.trim() || currentUser?.nickname || "我",
        avatarText,
        avatarUrl: currentUser?.avatarUrl,
        verified: currentUser?.campusVerified ?? true,
        mediaType: uploadedMedia?.type,
        mediaUrl: uploadedMedia?.url,
        mediaMimeType: uploadedMedia?.mimeType,
        createdAt: new Date().toISOString(),
        reason: `与你的 ${Math.min(draftCard.tags.length, 4)} 个标签相关`,
      });
      if (activeDraftId) deleteDraft(activeDraftId);
      setPublishFeedback("success");
    } catch (error) {
      console.warn("Publish meal card failed.", error);
      setPublishFeedback("idle");
      setPublishError("发布失败：云端暂时没有保存成功，请稍后再试。");
    }
  };

  return (
    <div className="app-shell min-h-[100dvh] pb-[calc(150px+env(safe-area-inset-bottom))]">
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
                className="display-cn flex h-14 w-14 items-center justify-center rounded-lg bg-[rgba(213,182,111,0.2)] text-2xl text-[#ffedb8] ring-1 ring-[rgba(255,237,184,0.24)]"
                aria-label="选择卡片头像"
              >
                {draftCard.avatarText}
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="display-cn text-[20px] text-[#fffdf3]">{draftCard.nickname}</p>
                  <BadgeCheck className="h-4 w-4 fill-[#d5b66f] text-[#365d51]" />
                </div>
                <p className="text-xs font-bold text-[#d8eade]">校园认证 · 你的约饭卡</p>
              </div>
            </div>

            {mediaPreviewUrl ? (
              <div className="card-content mt-4 overflow-hidden rounded-lg bg-black/20 ring-1 ring-white/15">
                <img src={mediaPreviewUrl} alt="约饭卡媒体预览" className="h-40 w-full object-cover" />
              </div>
            ) : null}

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
          <div className="grid grid-cols-2 gap-2">
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
          </div>
          {mediaType ? (
            <label className="mt-3 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[rgba(209,228,221,0.72)] text-sm font-black text-[var(--pine)]">
              {mediaFile ? "更换照片" : "选择照片"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  await setMedia(event.target.files?.[0] ?? null);
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

        <section className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={saveDraft}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-white/82 text-sm font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]"
          >
            <Save className="h-4 w-4" />
            保存草稿
          </button>
          <button
            onClick={() => setDraftsOpen(true)}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-white/82 text-sm font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]"
          >
            <FolderOpen className="h-4 w-4" />
            草稿箱
          </button>
          <div className="flex h-11 items-center justify-center gap-2 rounded-lg bg-white/82 text-sm font-black text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
            <Eye className="h-4 w-4" />
            {visibility}
          </div>
        </section>
        {draftSaved ? (
          <p className="mt-2 rounded-lg bg-[rgba(209,228,221,0.62)] px-3 py-2 text-center text-xs font-black text-[var(--pine)]">
            草稿已保存在本机，下次进入会自动恢复。
          </p>
        ) : null}

        <section className="mt-6">
          <SectionTitle title="标签" action="至少选择 2 个，也可以自己创建" />
          <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-2">
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
            <button
              onClick={handleDeleteTags}
              className={`flex h-11 items-center gap-1 rounded-lg px-4 text-sm font-black transition ${
                tagDeleteMode
                  ? tagDeleteTargets.length
                    ? "bg-[#d95f4f] text-white"
                    : "bg-[rgba(217,95,79,0.12)] text-[#9b493e] ring-1 ring-[rgba(217,95,79,0.24)]"
                  : "bg-[rgba(251,253,249,0.82)] text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {tagDeleteMode ? (tagDeleteTargets.length ? `删除${tagDeleteTargets.length}个` : "取消") : "删除"}
            </button>
          </div>
          {tagDeleteMode ? (
            <p className="mb-3 rounded-lg bg-[rgba(217,95,79,0.08)] px-3 py-2 text-xs font-bold text-[#9b493e]">
              点选要删除的标签，再点上方删除按钮一次性删除。
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {allTagOptions.map((tag) => {
              const selected = tags.includes(tag);
              const markedForDelete = tagDeleteTargets.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center overflow-hidden rounded-lg text-sm font-black transition ${
                    markedForDelete
                      ? "bg-[#d95f4f] text-white"
                      : selected
                        ? "bg-[var(--pine)] text-white"
                        : "bg-[rgba(251,253,249,0.82)] text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]"
                  }`}
                >
                  <span className="flex items-center gap-1 px-3 py-2">
                    {markedForDelete ? <Trash2 className="h-3.5 w-3.5" /> : selected ? <Check className="h-3.5 w-3.5" /> : null}
                    {tag}
                  </span>
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

      {draftsOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-[rgba(22,35,30,0.32)] px-3">
          <section className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[var(--pine)]">Drafts</p>
                <h2 className="display-cn text-[22px] text-[var(--text-main)]">饭卡草稿箱</h2>
              </div>
              <button
                onClick={() => setDraftsOpen(false)}
                className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]"
                aria-label="关闭草稿箱"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {savedDrafts.length ? (
              <div className="max-h-[56vh] space-y-2 overflow-y-auto pr-1">
                {savedDrafts.map((draft) => (
                  <article key={draft.id} className="rounded-lg bg-[rgba(244,248,244,0.92)] p-3 ring-1 ring-[var(--line-soft)]">
                    <div className="flex items-start justify-between gap-3">
                      <button onClick={() => loadDraft(draft)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-black text-[var(--text-main)]">{draft.text.trim() || "未命名饭卡"}</p>
                        <p className="mt-1 truncate text-xs font-bold text-[var(--text-muted)]">
                          {draft.place || draft.customPlace || "未选择地点"} · {draft.people || "人数未定"}
                        </p>
                        <p className="mt-2 text-[11px] font-bold text-[var(--text-faint)]">
                          {draft.mediaType === "photo" ? "含图片" : "无媒体"} · {new Date(draft.updatedAt).toLocaleString()}
                        </p>
                      </button>
                      <button
                        onClick={() => deleteDraft(draft.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[rgba(217,154,136,0.16)] text-[var(--coral)]"
                        aria-label="删除草稿"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-[rgba(244,248,244,0.92)] px-4 py-8 text-center ring-1 ring-[var(--line-soft)]">
                <FolderOpen className="mx-auto h-8 w-8 text-[var(--pine)]" />
                <p className="mt-3 text-sm font-black text-[var(--text-main)]">还没有饭卡草稿</p>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">保存后可以在这里继续编辑或删除。</p>
              </div>
            )}
          </section>
        </div>
      ) : null}

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
