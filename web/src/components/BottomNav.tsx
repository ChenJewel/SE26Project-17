/**
 * 底部主导航。
 *
 * 负责五个一级入口：首页、社区、发卡片、消息、我的。
 * 注意中间按钮语义固定为“发卡片”，不要和社区页右下角“发帖子”混在一起。
 */
import { Home, MessageCircle, Plus, User, UsersRound } from "lucide-react";

export type PageId = "home" | "community" | "create" | "chat" | "profile" | "settings";

interface BottomNavProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  chatUnreadCount?: number;
}

const navItems = [
  { id: "home" as const, icon: Home, label: "首页" },
  { id: "community" as const, icon: UsersRound, label: "社区" },
  { id: "create" as const, icon: Plus, label: "发卡片", featured: true },
  { id: "chat" as const, icon: MessageCircle, label: "消息" },
  { id: "profile" as const, icon: User, label: "我的" },
];

export default function BottomNav({ currentPage, onNavigate, chatUnreadCount = 0 }: BottomNavProps) {
  return (
    <nav className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line-soft)] bg-[rgba(245,248,244,0.88)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-3 pt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const unreadCount = item.id === "chat" ? chatUnreadCount : 0;
          const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);

          if (item.featured) {
            return (
              <button
                key={item.id}
                aria-label="发布约饭卡片"
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)]"
              >
                <span
                  className={`-mt-4 flex h-12 w-12 items-center justify-center rounded-lg border-[3px] border-[rgba(245,248,244,0.95)] shadow-[0_12px_24px_rgba(90,130,114,0.22)] transition ${
                    isActive ? "bg-[var(--pine)] text-white" : "bg-[var(--moss)] text-white"
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={2.4} />
                </span>
                <span className={isActive ? "text-[var(--pine)]" : ""}>{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex min-h-[50px] flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                isActive ? "text-[var(--pine)]" : "text-[var(--text-faint)]"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                {unreadCount > 0 ? (
                  <span className="absolute -right-3 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff3159] px-1 text-[10px] font-black leading-none text-white ring-2 ring-[rgba(245,248,244,0.96)]">
                    {unreadLabel}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
