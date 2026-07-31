import { Camera, Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { resolveAvatarUrl } from "@/lib/mediaUrl";
import { uploadBinaryMedia } from "@/services/uploadApi";
import type { CurrentUser } from "@/types/auth";

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
  const [selectedTags, setSelectedTags] = useState<string[]>(currentUser.preferenceTags ?? []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localAvatarPreviewUrl, setLocalAvatarPreviewUrl] = useState("");
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const displayAvatarUrl = localAvatarPreviewUrl || avatarUrl;

  const visibleTags = useMemo(() => {
    const tags = [...tagOptions, ...selectedTags].map((tag) => tag.trim()).filter(Boolean);
    return Array.from(new Set(tags)).slice(0, 18);
  }, [selectedTags, tagOptions]);

  useEffect(() => {
    return () => {
      if (localAvatarPreviewUrl) URL.revokeObjectURL(localAvatarPreviewUrl);
    };
  }, [localAvatarPreviewUrl]);

  useEffect(() => {
    setAvatarImageFailed(false);
  }, [displayAvatarUrl]);

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  };

  const replaceLocalPreview = (url: string) => {
    setLocalAvatarPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
  };

  const uploadAvatar = async (file: File) => {
    replaceLocalPreview(URL.createObjectURL(file));
    setAvatarImageFailed(false);
    setUploading(true);
    setNotice("");
    try {
      const asset = await uploadBinaryMedia({
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        file,
        purpose: "avatar",
      });
      setAvatarUrl(asset.url);
      replaceLocalPreview("");
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
    <main className="min-h-[100dvh] bg-[var(--page-bg)] text-[var(--text-main)]">
      <section className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-10">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[var(--pine)]">Welcome</p>
          <h1 className="mt-2 text-[32px] font-black leading-tight">先完善你的资料</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-muted)]">
            设置头像、昵称和可选偏好，保存后以后登录不会再出现这个页面。
          </p>
        </div>

        <div className="mt-7 rounded-lg bg-white/86 p-4 shadow-sm ring-1 ring-[var(--line-soft)]">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-3xl font-black text-[#28483f]">
              {displayAvatarUrl && !avatarImageFailed ? (
                <img
                  src={localAvatarPreviewUrl || resolveAvatarUrl(avatarUrl)}
                  alt="头像预览"
                  className="h-full w-full object-cover"
                  onError={() => setAvatarImageFailed(true)}
                />
              ) : (
                avatarText
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label className="text-xs font-black text-[var(--text-muted)]">昵称</label>
              <input
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  if (!avatarUrl && event.target.value.trim()) setAvatarText(event.target.value.trim().slice(0, 1));
                }}
                className="mt-2 h-11 w-full rounded-lg bg-[var(--surface-soft)] px-3 text-base font-black text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)]"
                placeholder="输入昵称"
              />
              <label className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[var(--pine)] px-4 text-sm font-black text-white">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                从相册选头像
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadAvatar(file);
                    event.target.value = "";
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
              <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">可选。没有填写时，我的主页会保持空偏好。</p>
            </div>
            <span className="shrink-0 text-sm font-black text-[var(--pine)]">已选 {selectedTags.length}</span>
          </div>
          {visibleTags.length ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {visibleTags.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`min-h-[72px] rounded-lg p-3 text-left ring-1 transition ${
                      selected ? "bg-[rgba(209,228,221,0.82)] ring-[var(--pine)]" : "bg-white/82 ring-[var(--line-soft)]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-base font-black">{tag}</span>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${selected ? "bg-[var(--pine)] text-white" : "bg-[var(--surface-soft)] text-[var(--text-faint)]"}`}>
                        <Check className="h-4 w-4" />
                      </span>
                    </span>
                    <span className="mt-2 block text-xs font-semibold text-[var(--text-muted)]">推荐会按这个偏好调整</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-white/76 p-4 text-center text-sm font-semibold text-[var(--text-muted)]">
              暂时没有可选偏好；注册时填写的 MBTI 会自动保存为偏好。
            </p>
          )}
        </section>

        {notice ? <p className="mt-4 text-center text-sm font-black text-[var(--coral)]">{notice}</p> : null}
        <button
          onClick={save}
          disabled={saving || uploading}
          className="mt-4 h-12 w-full rounded-full bg-[var(--pine)] text-base font-black text-white shadow-[0_14px_30px_rgba(63,111,96,0.18)] disabled:opacity-50"
        >
          {saving ? "保存中..." : `进入 U eat（已选 ${selectedTags.length} 个）`}
        </button>
      </section>
    </main>
  );
}
