import { Home, MessageCircle, Plus, User, UsersRound } from "lucide-react";

export type PageId = "home" | "community" | "create" | "chat" | "profile";

interface BottomNavProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

const navItems = [
  { id: "home" as const, icon: Home, label: "首页" },
  { id: "community" as const, icon: UsersRound, label: "社区" },
  { id: "create" as const, icon: Plus, label: "发卡片", featured: true },
  { id: "chat" as const, icon: MessageCircle, label: "消息" },
  { id: "profile" as const, icon: User, label: "我的" },
];

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line-soft)] bg-[rgba(245,248,244,0.88)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-3 pb-2.5 pt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

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
              className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                isActive ? "text-[var(--pine)]" : "text-[var(--text-faint)]"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
