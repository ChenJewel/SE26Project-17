import { type ReactNode } from "react";

/**
 * 我的页内容分区容器。
 *
 * 发布、喜欢、收藏、关注等列表统一使用这个容器，避免迁移时每个分区重复空状态逻辑。
 */
export function ProfileSection({
  icon,
  title,
  empty,
  children,
  onOpenAll,
}: {
  icon: ReactNode;
  title: string;
  empty: string;
  children: ReactNode;
  onOpenAll?: () => void;
}) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);
  const toneClass = getProfileSectionTone(title);

  return (
    <section className={`profile-liquid-section ${toneClass} mt-5`}>
      <div className="profile-liquid-section-header mb-3 flex items-center gap-2 px-1">
        <span className="profile-liquid-icon flex h-8 w-8 items-center justify-center rounded-lg text-[var(--pine)] [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 font-black text-[var(--text-main)]">{title}</h2>
        {hasContent && onOpenAll ? (
          <button onClick={onOpenAll} className="profile-liquid-more h-8 rounded-lg px-3 text-xs font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]">
            全部
          </button>
        ) : null}
      </div>
      <div className="profile-liquid-content relative max-h-[340px] overflow-hidden">
        <div className="space-y-2">
          {hasContent ? children : (
            <div className="rounded-lg bg-white/72 p-4 text-center text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
              {empty}
            </div>
          )}
        </div>
        {hasContent ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-[linear-gradient(180deg,rgba(237,246,242,0),rgba(237,246,242,0.96))]" /> : null}
      </div>
    </section>
  );
}

export function getProfileSectionTone(title: string) {
  if (title.includes("\u504f\u597d")) return "profile-vapor-mint";
  if (title.includes("\u7ea6\u996d\u5361")) return "profile-vapor-pink";
  if (title.includes("\u53d1\u5e03") && title.includes("\u5e16\u5b50")) return "profile-vapor-blue";
  if (title.includes("\u8bc4\u8bba")) return "profile-vapor-lavender";
  if (title.includes("\u559c\u6b22")) return "profile-vapor-pink";
  if (title.includes("\u6536\u85cf")) return "profile-vapor-sky";
  if (title.includes("\u5173\u6ce8")) return "profile-vapor-yellow";
  return "profile-vapor-blue";
}
