import { Camera, Check, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { preferenceTagToneClasses } from "@/components/profile/PreferenceTagEditor";
import { resolveAvatarUrl } from "@/lib/mediaUrl";
import { uploadMedia } from "@/services/uploadApi";
import type { CurrentUser } from "@/types/auth";

const fallbackTags = ["晚饭", "二食堂", "清淡", "火锅", "咖啡", "自习搭子", "电影", "散步", "甜品", "同校", "周末", "拼桌"];

const mbtiOptions = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
] as const;

export default function ProfileOnboarding({
  currentUser,
  tagOptions,
  onComplete,
}: {
  currentUser: CurrentUser;
  tagOptions: string[];
  onComplete: (input: {
    nickname: string;
    avatarText: string;
    avatarUrl?: string;
    preferenceTags: string[];
    profileCompleted: boolean;
  }) => Promise<CurrentUser>;
}) {
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [avatarText, setAvatarText] = useState(currentUser.avatarText || currentUser.nickname.slice(0, 1) || "我");
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMbti, setSelectedMbti] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");

  const visibleTags = useMemo(() => {
    const tags = [...tagOptions, ...fallbackTags]
      .map((tag) => tag.trim())
      .filter((tag) => tag && tag !== "MBTI" && !mbtiOptions.includes(tag as (typeof mbtiOptions)[number]));
    return Array.from(new Set(tags)).slice(0, 18);
  }, [tagOptions]);

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };
  const selectedPreferenceCount = selectedTags.length + (selectedMbti ? 1 : 0);

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    setNotice("");
    try {
      const asset = await uploadMedia({
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        dataBase64: await fileToBase64(file),
        purpose: "avatar",
      });
      setAvatarUrl(asset.url);
    } catch (error) {
      console.warn("Failed to upload onboarding avatar.", error);
      setNotice("头像上传失败，请换一张图片再试。");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const nextNickname = nickname.trim();
    if (!nextNickname) {
      setNotice("先设置一个昵称。");
      return;
    }
    const preferenceTags = Array.from(new Set([...selectedTags, selectedMbti ? `MBTI ${selectedMbti}` : ""])).filter(Boolean);
    if (!selectedPreferenceCount) {
      setNotice("至少选择一个我的偏好。");
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      await onComplete({
        nickname: nextNickname,
        avatarText: avatarText.trim().slice(0, 2) || nextNickname.slice(0, 1) || "我",
        avatarUrl,
        preferenceTags,
        profileCompleted: true,
      });
    } catch (error) {
      console.warn("Failed to complete onboarding.", error);
      setNotice("保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="frosted-page-shell min-h-[100dvh] text-[var(--text-main)]">
      <section className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-10">
        <div>
          <p className="text-sm font-black uppercase text-[var(--pine)]">Welcome</p>
          <h1 className="display-cn mt-2 text-[32px] leading-tight text-[var(--text-main)]">先完善你的资料</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-muted)]">设置头像、昵称和偏好，保存后以后登录不会再出现这个页面。</p>
        </div>

        <div className="mt-7 rounded-lg bg-white/82 p-4 shadow-[0_12px_30px_rgba(45,88,75,0.08)] ring-1 ring-[var(--line-soft)] backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#b4dbca] text-3xl font-black text-[#2d584b]">
              {avatarUrl ? <img src={resolveAvatarUrl(avatarUrl)} alt="头像预览" className="h-full w-full object-cover" /> : avatarText}
            </div>
            <div className="min-w-0 flex-1">
              <label className="text-xs font-black text-[var(--text-muted)]">昵称</label>
              <input
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  if (!avatarUrl && event.target.value.trim()) setAvatarText(event.target.value.trim().slice(0, 1));
                }}
                className="mt-2 h-11 w-full rounded-lg bg-[var(--surface-raised)] px-3 text-base font-black text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--pine)]"
                placeholder="输入昵称"
              />
              <label className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[var(--pine)] px-4 text-sm font-black text-white shadow-[0_8px_18px_rgba(68,136,112,0.18)]">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                从相册选头像
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadAvatar(file);
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <section className="mt-5 rounded-lg bg-white/82 p-4 shadow-[0_12px_30px_rgba(45,88,75,0.08)] ring-1 ring-[var(--line-soft)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-[var(--pine)]">MBTI</p>
              <h2 className="mt-1 text-lg font-black text-[var(--text-main)]">MBTI 是什么</h2>
            </div>
            {selectedMbti ? (
              <button onClick={() => setSelectedMbti("")} className="text-xs font-black text-[var(--text-muted)]">
                清除
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {mbtiOptions.map((mbti) => {
              const selected = selectedMbti === mbti;
              return (
                <button
                  key={mbti}
                  onClick={() => setSelectedMbti(selected ? "" : mbti)}
                  className={`h-10 rounded-lg text-xs font-black transition ${
                    selected
                      ? "bg-[var(--pine)] text-white shadow-[0_8px_18px_rgba(68,136,112,0.18)]"
                      : "bg-[rgba(244,248,244,0.92)] text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]"
                  }`}
                >
                  {mbti}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-7 min-h-0 flex-1">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-black text-[var(--text-main)]">选择我的偏好</h2>
              <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">用于首页推荐、发卡片标签和个人主页展示。</p>
            </div>
            <span className="shrink-0 text-sm font-black text-[var(--pine)]">已选 {selectedPreferenceCount}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {visibleTags.map((tag, index) => {
              const selected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`min-h-[72px] rounded-lg p-3 text-left transition ${selected ? preferenceTagToneClasses[index % preferenceTagToneClasses.length] : "bg-white/78 text-[var(--text-main)] ring-1 ring-[var(--line-soft)]"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-base font-black">{tag}</span>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${selected ? "bg-white/72 text-[#2d584b]" : "bg-[var(--surface-soft)] ring-1 ring-[var(--line-soft)]"}`}>
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </span>
                  </span>
                  <span className="mt-2 block text-xs font-semibold opacity-65">推荐会按这个偏好调整</span>
                </button>
              );
            })}
          </div>
        </section>

        {notice ? <p className="mt-4 rounded-lg bg-[rgba(221,67,80,0.08)] px-3 py-2 text-center text-sm font-black text-[var(--coral)] ring-1 ring-[rgba(221,67,80,0.16)]">{notice}</p> : null}
        <button
          onClick={save}
          disabled={saving || uploading}
          className="mt-4 h-12 w-full rounded-lg bg-[var(--pine)] text-base font-black text-white shadow-[0_14px_30px_rgba(68,136,112,0.2)] disabled:opacity-50"
        >
          {saving ? "保存中..." : `进入 U eat（已选${selectedPreferenceCount}个）`}
        </button>
      </section>
    </main>
  );
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
