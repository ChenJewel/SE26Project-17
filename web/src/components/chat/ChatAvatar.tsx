/**
 * 消息模块专用头像。
 *
 * 群聊和单聊目前都用字符头像；未来接真实头像时，可在这里兼容 avatarUrl。
 */
import { resolveAvatarUrl } from "@/lib/mediaUrl";

export function ChatAvatar({ text, imageUrl, group }: { text: string; imageUrl?: string; group?: boolean }) {
  const resolvedImageUrl = resolveAvatarUrl(imageUrl);
  return (
    <span
      className={`display-cn flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full text-xl text-[#28483f] ${
        group
          ? "bg-gradient-to-br from-[#fff7d7] via-[#d1e4dd] to-[#b7b0d8]"
          : "bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7]"
      }`}
    >
      {resolvedImageUrl ? <img src={resolvedImageUrl} alt={text} className="h-full w-full rounded-full object-cover" /> : text}
    </span>
  );
}
