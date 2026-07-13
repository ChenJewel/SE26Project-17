import { BadgeCheck, Settings } from "lucide-react";

/**
 * 我的页顶部区域。
 *
 * 正式版应从 profile API 读取用户资料、头像 URL、认证状态和统计数。
 * 当前仍用字符头像和本地统计值展示原型。
 */
export function ProfileHeader({
  nickname,
  authSummary,
  avatarText,
  postCount,
  cardCount,
  commentCount,
  onAvatarOpen,
  onSettings,
}: {
  nickname: string;
  authSummary: string;
  avatarText: string;
  postCount: number;
  cardCount: number;
  commentCount: number;
  onAvatarOpen: () => void;
  onSettings: () => void;
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
            className="display-cn flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-3xl text-[#28483f]"
            aria-label="查看和编辑头像"
          >
            {avatarText}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="display-cn text-[24px] text-[#fffdf3]">{nickname}</h2>
              <BadgeCheck className="h-5 w-5 fill-[#d5b66f] text-[#365d51]" />
            </div>
            <p className="mt-1 text-sm font-bold text-[#d8eade]">{authSummary}</p>
          </div>
        </div>

        <div className="card-content mt-6 grid grid-cols-3 gap-3">
          <Stat value={String(postCount)} label="已发帖子" />
          <Stat value={String(cardCount)} label="划卡卡片" />
          <Stat value={String(commentCount)} label="我的评论" />
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-[rgba(255,255,255,0.12)] p-3 text-center ring-1 ring-[rgba(255,255,255,0.16)]">
      <p className="text-xl font-black text-[#fffdf3]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#d8eade]">{label}</p>
    </div>
  );
}
