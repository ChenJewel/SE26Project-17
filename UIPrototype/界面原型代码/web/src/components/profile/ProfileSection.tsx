import type { ReactNode } from "react";

/**
 * 我的页内容分区容器。
 *
 * 发布、喜欢、收藏、关注等列表统一用这个容器，避免迁移时每个分区都重复空状态逻辑。
 */
export function ProfileSection({ icon, title, empty, children }: { icon: ReactNode; title: string; empty: string; children: ReactNode }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)] [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <h2 className="font-black text-[var(--text-main)]">{title}</h2>
      </div>
      <div className="space-y-2">
        {hasContent ? children : (
          <div className="rounded-lg bg-white/72 p-4 text-center text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}
