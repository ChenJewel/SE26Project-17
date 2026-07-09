import { Home, MessageCircle, Plus, User, UsersRound } from "lucide-react";

export type PageId = "home" | "community" | "create" | "chat" | "profile";

interface BottomNavProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

const navItems = [
  { id: "home" as const, icon: Home, label: "首页" },
  { id: "community" as const, icon: UsersRound, label: "社区" },
  { id: "create" as const, icon: Plus, label: "发布", featured: true },
  { id: "chat" as const, icon: MessageCircle, label: "聊天" },
  { id: "profile" as const, icon: User, label: "我的" },
];

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(217,221,210,0.78)] bg-[rgba(251,250,245,0.78)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-3 pb-2.5 pt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          if (item.featured) {
            return (
              <button
                key={item.id}
                aria-label="发布约饭卡"
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center gap-1 text-[11px] font-medium text-[var(--mist-muted)]"
              >
                <span
                  className={`-mt-4 flex h-12 w-12 items-center justify-center rounded-xl border-[3px] border-[rgba(251,250,245,0.86)] shadow-[0_10px_24px_rgba(78,101,93,0.16)] transition ${
                    isActive ? "bg-[var(--mist-tea-deep)] text-[#fbfaf5]" : "bg-[#5e7564] text-[#fbfaf5]"
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={2.4} />
                </span>
                <span className={isActive ? "text-[var(--mist-tea-deep)]" : ""}>{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition ${
                isActive ? "text-[var(--mist-tea-deep)]" : "text-[#9aa098]"
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
