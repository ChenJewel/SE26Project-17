import { Bookmark, Heart, MessageCircle, Utensils } from "lucide-react";
import type { ReactNode } from "react";
import type { CommunityPost } from "@/data/community";

/**
 * 帖子详情共用统计条。
 *
 * 搜索详情和社区详情都应从这里开始共享帖子展示规则；
 * 后续再把正文、媒体和评论区继续合并到同一个 PostDetailView。
 */
export function PostStatsRow({ post }: { post: CommunityPost }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center text-xs font-black text-[var(--text-muted)]">
      <PostStat icon={<Heart />} value={post.likes} label="喜欢" />
      <PostStat icon={<Bookmark />} value={post.favorites} label="收藏" />
      <PostStat icon={<MessageCircle />} value={String(post.comments)} label="评论" />
      <PostStat icon={<Utensils />} value={post.channel} label="频道" />
    </div>
  );
}

function PostStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-soft)] p-2">
      <span className="mx-auto flex h-5 w-5 items-center justify-center text-[var(--pine)] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <p className="mt-1 truncate">{value}</p>
      <p className="text-[11px] text-[var(--text-faint)]">{label}</p>
    </div>
  );
}
