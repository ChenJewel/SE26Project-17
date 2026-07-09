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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-3 pb-3 pt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          if (item.featured) {
            return (
              <button
                key={item.id}
                aria-label="发布约饭卡"
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500"
              >
                <span
                  className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white shadow-lg transition ${
                    isActive ? "bg-emerald-700 text-white" : "bg-slate-950 text-white"
                  }`}
                >
                  <Icon className="h-7 w-7" strokeWidth={2.6} />
                </span>
                <span className={isActive ? "text-emerald-700" : ""}>{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] font-medium transition ${
                isActive ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.6]" : ""}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
