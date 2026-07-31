import { BadgeCheck, Settings, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { resolveAvatarUrl } from "@/lib/mediaUrl";

export function ProfileHeader({
  nickname,
  authSummary,
  avatarText,
  avatarUrl,
  postCount,
  cardCount,
  commentCount,
  followerCount,
  followingCount,
  isAdmin,
  onAvatarOpen,
  onSettings,
  onFollowersOpen,
  onFollowingOpen,
  onPostsOpen,
  onCardsOpen,
  onCommentsOpen,
}: {
  nickname: string;
  authSummary: string;
  avatarText: string;
  avatarUrl?: string;
  postCount: number;
  cardCount: number;
  commentCount: number;
  followerCount: number;
  followingCount: number;
  isAdmin?: boolean;
  onAvatarOpen: () => void;
  onSettings: () => void;
  onFollowersOpen?: () => void;
  onFollowingOpen?: () => void;
  onPostsOpen?: () => void;
  onCardsOpen?: () => void;
  onCommentsOpen?: () => void;
}) {
  const resolvedAvatarUrl = resolveAvatarUrl(avatarUrl);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [resolvedAvatarUrl]);

  return (
    <>
      <header className="page-header sticky top-0 z-20">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <div>
            <p className="text-[13px] font-bold text-[var(--pine)]">Profile</p>
            <h1 className="display-cn text-[25px] text-[var(--text-main)]">我的</h1>
          </div>
          <button
            aria-label="打开 ueat 设置"
            onClick={onSettings}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line-soft)] bg-white/80 text-[var(--pine)] shadow-sm"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <section className="meal-card rounded-lg p-5 shadow-[0_28px_68px_rgba(36,116,95,0.28)]">
        <div className="card-content flex items-center gap-4">
          <button
            onClick={onAvatarOpen}
            className="display-cn flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-3xl text-[#28483f] shadow-[0_16px_34px_rgba(12,49,39,0.18)] ring-2 ring-white/38"
            aria-label="查看和编辑头像"
          >
            {resolvedAvatarUrl && !avatarFailed ? (
              <img src={resolvedAvatarUrl} alt="头像" className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} />
            ) : (
              avatarText
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="display-cn truncate text-[24px] text-[#fffdf3]">{nickname}</h2>
              <BadgeCheck className="h-5 w-5 shrink-0 fill-[#d5b66f] text-[#365d51]" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#d8eade]">{authSummary}</p>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7d7] px-2 py-0.5 text-[11px] font-black text-[#806636] ring-1 ring-white/60">
                  <ShieldCheck className="h-3 w-3" />
                  管理员
                </span>
              ) : null}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/16">
              <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,#fff7d7,#8fd4b8)]" />
            </div>
          </div>
        </div>

        <div className="card-content mt-6 grid grid-cols-5 gap-2">
          <Stat value={String(followerCount)} label="粉丝" onClick={onFollowersOpen} />
          <Stat value={String(followingCount)} label="关注" onClick={onFollowingOpen} />
          <Stat value={String(postCount)} label="帖子" onClick={onPostsOpen} />
          <Stat value={String(cardCount)} label="卡片" onClick={onCardsOpen} />
          <Stat value={String(commentCount)} label="评论" onClick={onCommentsOpen} />
        </div>
      </section>
    </>
  );
}

function Stat({ value, label, onClick }: { value: string; label: string; onClick?: () => void }) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className="rounded-lg bg-[rgba(255,255,255,0.14)] p-2 text-center ring-1 ring-[rgba(255,255,255,0.18)] backdrop-blur transition hover:bg-[rgba(255,255,255,0.18)]"
    >
      <p className="text-lg font-black text-[#fffdf3]">{value}</p>
      <p className="mt-1 text-[11px] font-bold text-[#d8eade]">{label}</p>
    </Component>
  );
}
