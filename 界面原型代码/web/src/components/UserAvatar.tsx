/**
 * 用户头像的原型展示组件。
 *
 * 当前头像只是字符/emoji，占位真实头像资源。
 * 后续接后端时可以把 text 换成 imageUrl，并在这个组件里集中兼容 Web/Taro/小程序头像渲染。
 */
export default function UserAvatar({
  text,
  size = "md",
  rounded = "lg",
  className = "",
}: {
  text: string;
  size?: "sm" | "md" | "lg";
  rounded?: "full" | "lg";
  className?: string;
}) {
  const sizeClass = {
    sm: "h-8 w-8 text-[13px]",
    md: "h-11 w-11 text-lg",
    lg: "h-[72px] w-[72px] text-3xl",
  }[size];

  const roundedClass = rounded === "full" ? "rounded-full" : "rounded-lg";

  return (
    <span
      className={`display-cn flex shrink-0 items-center justify-center ${roundedClass} bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-[#28483f] ${sizeClass} ${className}`}
    >
      {text}
    </span>
  );
}
