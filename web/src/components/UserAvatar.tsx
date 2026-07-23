/**
 * 用户头像的原型展示组件。
 *
 * 当前头像只是字符/emoji，占位真实头像资源。
 * 后续接后端时可以把 text 换成 imageUrl，并在这个组件里集中兼容 Web/Taro/小程序头像渲染。
 */
import { useEffect, useState } from "react";
import { resolveAvatarUrl } from "@/lib/mediaUrl";

export default function UserAvatar({
  text,
  imageUrl,
  size = "md",
  rounded = "lg",
  className = "",
}: {
  text: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
  rounded?: "full" | "lg";
  className?: string;
}) {
  const resolvedImageUrl = resolveAvatarUrl(imageUrl);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [resolvedImageUrl]);
  const sizeClass = {
    sm: "h-8 w-8 text-[13px]",
    md: "h-11 w-11 text-lg",
    lg: "h-[72px] w-[72px] text-3xl",
  }[size];

  const roundedClass = rounded === "full" ? "rounded-full" : "rounded-lg";

  return (
    <span
      className={`display-cn flex aspect-square flex-none shrink-0 self-start items-center justify-center overflow-hidden ${roundedClass} bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-[#28483f] ${sizeClass} ${className}`}
      style={{ aspectRatio: "1 / 1" }}
    >
      {resolvedImageUrl && !imageFailed ? (
        <img src={resolvedImageUrl} alt={text} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
      ) : (
        text
      )}
    </span>
  );
}
