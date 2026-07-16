import { Camera, Check, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { resolveAvatarUrl } from "@/lib/mediaUrl";
import { uploadMedia } from "@/services/uploadApi";
import type { CurrentUser } from "@/types/auth";

const fallbackTags = ["晚饭", "二食堂", "清淡", "火锅", "咖啡", "自习搭子", "电影", "散步", "甜品", "同校", "周末", "拼桌"];

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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");

  const visibleTags = useMemo(() => {
    const tags = [...tagOptions, ...fallbackTags].map((tag) => tag.trim()).filter(Boolean);
    return Array.from(new Set(tags)).slice(0, 18);
  }, [tagOptions]);

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

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
    if (!selectedTags.length) {
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
        preferenceTags: selectedTags,
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
    <main className="min-h-[100dvh] bg-[#111510] text-white">
      <section className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-10">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#d5b66f]">Welcome</p>
          <h1 className="mt-2 text-[32px] font-black leading-tight">先完善你的资料</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/62">设置头像、昵称和偏好，保存后以后登录不会再出现这个页面。</p>
        </div>

        <div className="mt-7 rounded-lg bg-white/8 p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-3xl font-black text-[#28483f]">
              {avatarUrl ? <img src={resolveAvatarUrl(avatarUrl)} alt="头像预览" className="h-full w-full object-cover" /> : avatarText}
            </div>
            <div className="min-w-0 flex-1">
              <label className="text-xs font-black text-white/55">昵称</label>
              <input
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  if (!avatarUrl && event.target.value.trim()) setAvatarText(event.target.value.trim().slice(0, 1));
                }}
                className="mt-2 h-11 w-full rounded-lg bg-black/24 px-3 text-base font-black text-white outline-none ring-1 ring-white/12 placeholder:text-white/30"
                placeholder="输入昵称"
              />
              <label className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#d5b66f] px-4 text-sm font-black text-[#17231f]">
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

        <section className="mt-7 min-h-0 flex-1">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-black">选择我的偏好</h2>
              <p className="mt-1 text-sm font-semibold text-white/52">用于首页推荐、发卡片标签和个人主页展示。</p>
            </div>
            <span className="shrink-0 text-sm font-black text-[#d5b66f]">已选 {selectedTags.length}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {visibleTags.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`min-h-[72px] rounded-lg p-3 text-left ring-1 transition ${selected ? "bg-[#241f11] ring-[#d5b66f]" : "bg-white/8 ring-white/10"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-base font-black">{tag}</span>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${selected ? "bg-[#d5b66f] text-[#17231f]" : "bg-white/16 text-white/50"}`}>
                      <Check className="h-4 w-4" />
                    </span>
                  </span>
                  <span className="mt-2 block text-xs font-semibold text-white/48">推荐会按这个偏好调整</span>
                </button>
              );
            })}
          </div>
        </section>

        {notice ? <p className="mt-4 text-center text-sm font-black text-[#f0a293]">{notice}</p> : null}
        <button
          onClick={save}
          disabled={saving || uploading}
          className="mt-4 h-12 w-full rounded-full bg-[#d5b66f] text-base font-black text-[#17231f] shadow-[0_14px_30px_rgba(213,182,111,0.18)] disabled:opacity-50"
        >
          {saving ? "保存中..." : `进入 U eat（已选${selectedTags.length}个）`}
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
