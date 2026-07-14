import { BadgeCheck, Settings } from "lucide-react";

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
  onAvatarOpen,
  onSettings,
  onFollowersOpen,
  onFollowingOpen,
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
  onAvatarOpen: () => void;
  onSettings: () => void;
  onFollowersOpen?: () => void;
  onFollowingOpen?: () => void;
}) {
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

      <section className="meal-card rounded-lg p-5">
        <div className="card-content flex items-center gap-4">
          <button
            onClick={onAvatarOpen}
            className="display-cn flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-3xl text-[#28483f]"
            aria-label="查看和编辑头像"
          >
            {avatarUrl ? <img src={avatarUrl} alt="头像" className="h-full w-full object-cover" /> : avatarText}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="display-cn truncate text-[24px] text-[#fffdf3]">{nickname}</h2>
              <BadgeCheck className="h-5 w-5 shrink-0 fill-[#d5b66f] text-[#365d51]" />
            </div>
            <p className="mt-1 text-sm font-bold text-[#d8eade]">{authSummary}</p>
          </div>
        </div>

        <div className="card-content mt-6 grid grid-cols-5 gap-2">
          <Stat value={String(followerCount)} label="粉丝" onClick={onFollowersOpen} />
          <Stat value={String(followingCount)} label="关注" onClick={onFollowingOpen} />
          <Stat value={String(postCount)} label="帖子" />
          <Stat value={String(cardCount)} label="卡片" />
          <Stat value={String(commentCount)} label="评论" />
        </div>
      </section>
    </>
  );
}

function Stat({ value, label, onClick }: { value: string; label: string; onClick?: () => void }) {
  const Component = onClick ? "button" : "div";
  return (
    <Component onClick={onClick} className="rounded-lg bg-[rgba(255,255,255,0.12)] p-2 text-center ring-1 ring-[rgba(255,255,255,0.16)]">
      <p className="text-lg font-black text-[#fffdf3]">{value}</p>
      <p className="mt-1 text-[11px] font-bold text-[#d8eade]">{label}</p>
    </Component>
  );
}
