/**
 * 消息模块专用头像。
 *
 * 群聊和单聊目前都用字符头像；未来接真实头像时，可在这里兼容 avatarUrl。
 */
import { resolveAvatarUrl } from "@/lib/mediaUrl";

export function ChatAvatar({ text, imageUrl, group, compact = false }: { text: string; imageUrl?: string; group?: boolean; compact?: boolean }) {
  const resolvedImageUrl = resolveAvatarUrl(imageUrl);
  return (
    <span
      className={`display-cn flex shrink-0 items-center justify-center rounded-full text-[#28483f] ${compact ? "h-11 w-11 text-base" : "h-[58px] w-[58px] text-xl"} ${
        group ? "bg-[#b9bb9f]" : "bg-[#b4dbca]"
      }`}
    >
      {resolvedImageUrl ? <img src={resolvedImageUrl} alt={text} className="h-full w-full rounded-full object-cover" /> : text}
    </span>
  );
}
